"""Tests for the parts that decide whether money can move.

WebAuthn signatures need a real authenticator, so the passkey ceremony is exercised at the
library boundary (a rejected registration, an unknown credential) and the session it would
issue is minted directly here, with the same signer the server uses.
"""

import os
import sys
from pathlib import Path

import pyotp
import pytest
from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

SECRET = 'test-secret-not-a-real-one'


@pytest.fixture
def client(tmp_path, monkeypatch):
    for key in list(os.environ):
        if key.startswith('PANGEA_'):
            monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv('PANGEA_SESSION_SECRET', SECRET)
    monkeypatch.setenv('PANGEA_DB_PATH', str(tmp_path / 'pangea.db'))
    monkeypatch.setenv('PANGEA_ENROLL_CODE', 'let-me-in')
    monkeypatch.setenv('PANGEA_COOKIE_SECURE', 'false')
    monkeypatch.setenv('PANGEA_COOKIE_SAMESITE', 'lax')

    from app.config import settings

    settings.cache_clear()
    from app.main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client
    settings.cache_clear()


def sign_in(client: TestClient, user_id: str = 'elle', display_name: str = 'Elle') -> None:
    client.app.state.store.upsert_user(user_id, display_name)
    token = TimestampSigner(SECRET, salt='pangea-session').sign(user_id).decode()
    client.cookies.set('pangea_session', token)


def test_health_reports_configuration(client):
    body = client.get('/api/health').json()
    assert body['ok'] is True
    assert body['brokerConfigured'] is False


@pytest.mark.parametrize(
    ('method', 'path', 'payload'),
    [
        ('get', '/api/snapshot', None),
        ('get', '/api/market/quotes', None),
        ('get', '/api/broker/status', None),
        ('post', '/api/control', {'action': 'stop_everything'}),
        (
            'post',
            '/api/orders/manual',
            {'symbol': 'MES', 'side': 'long', 'riskPct': 0.5, 'stop': 'normal'},
        ),
    ],
)
def test_engine_is_closed_without_a_session(client, method, path, payload):
    response = getattr(client, method)(path, **({'json': payload} if payload else {}))
    assert response.status_code == 401


def test_forged_session_cookie_is_rejected(client):
    client.app.state.store.upsert_user('elle', 'Elle')
    client.cookies.set('pangea_session', 'elle.forged.signature')
    assert client.get('/api/auth/me').status_code == 401


def test_enrolment_needs_the_code(client):
    body = {'user_id': 'elle', 'display_name': 'Elle', 'enroll_code': 'guess'}
    assert client.post('/api/auth/passkey/enroll/options', json=body).status_code == 403


def test_enrolment_returns_platform_authenticator_options(client):
    body = {'user_id': 'elle', 'display_name': 'Elle', 'enroll_code': 'let-me-in'}
    response = client.post('/api/auth/passkey/enroll/options', json=body)
    assert response.status_code == 200
    options = response.json()['options']
    assert '"platform"' in options
    assert '"required"' in options


def test_login_options_refuse_a_user_without_a_passkey(client):
    client.app.state.store.upsert_user('elle', 'Elle')
    assert (
        client.post('/api/auth/passkey/login/options', json={'user_id': 'elle'}).status_code == 404
    )


def test_replayed_registration_response_is_rejected(client):
    body = {'user_id': 'elle', 'display_name': 'Elle', 'enroll_code': 'let-me-in'}
    client.post('/api/auth/passkey/enroll/options', json=body)
    bogus = {
        'user_id': 'elle',
        'credential': {'id': 'x', 'rawId': 'x', 'response': {}, 'type': 'public-key'},
    }
    first = client.post('/api/auth/passkey/enroll/verify', json=bogus)
    assert first.status_code == 400
    # The challenge is single-use, so even a correct response cannot be replayed.
    assert client.post('/api/auth/passkey/enroll/verify', json=bogus).status_code == 400


def test_control_refuses_and_says_why_when_no_broker(client):
    sign_in(client)
    body = client.post('/api/control', json={'action': 'stop_everything'}).json()
    assert body['accepted'] is False
    assert 'Nothing was sent' in body['reason']


def test_manual_order_is_never_reported_as_routed(client):
    sign_in(client)
    body = client.post(
        '/api/orders/manual',
        json={'symbol': 'MES', 'side': 'long', 'riskPct': 0.5, 'stop': 'normal'},
    ).json()
    assert body['accepted'] is False
    assert 'Nothing was routed' in body['reason']


def test_snapshot_refuses_rather_than_inventing_an_account(client):
    sign_in(client)
    response = client.get('/api/snapshot')
    assert response.status_code == 503
    assert 'No account state' in response.json()['detail']


def test_manual_order_rejects_an_unbounded_risk(client):
    sign_in(client)
    response = client.post(
        '/api/orders/manual',
        json={'symbol': 'MES', 'side': 'long', 'riskPct': 25, 'stop': 'normal'},
    )
    assert response.status_code == 422


def test_control_rejects_an_unknown_action(client):
    sign_in(client)
    assert client.post('/api/control', json={'action': 'raise_limits'}).status_code == 422


def test_totp_enrolment_round_trip(client):
    sign_in(client)
    enrolled = client.post('/api/auth/totp/enroll').json()
    assert enrolled['verified'] is False
    assert enrolled['otpauthUri'].startswith('otpauth://totp/')
    assert enrolled['qrPngBase64']

    secret = enrolled['otpauthUri'].split('secret=')[1].split('&')[0]
    right = pyotp.TOTP(secret).now()
    wrong = str((int(right) + 1) % 1_000_000).zfill(6)
    assert client.post('/api/auth/totp/enroll/verify', json={'code': wrong}).status_code == 401
    assert client.post('/api/auth/totp/enroll/verify', json={'code': right}).status_code == 200
    assert client.get('/api/auth/me').json()['totpEnrolled'] is True


def test_totp_login_needs_the_passkey_step_first(client):
    sign_in(client)
    enrolled = client.post('/api/auth/totp/enroll').json()
    secret = enrolled['otpauthUri'].split('secret=')[1].split('&')[0]
    client.post('/api/auth/totp/enroll/verify', json={'code': pyotp.TOTP(secret).now()})
    client.cookies.clear()
    response = client.post('/api/auth/totp/login', json={'code': pyotp.TOTP(secret).now()})
    assert response.status_code == 401


def test_logout_expires_both_cookies(client):
    sign_in(client)
    assert client.get('/api/auth/me').status_code == 200
    response = client.post('/api/auth/logout')
    expired = [h for h in response.headers.get_list('set-cookie') if 'Max-Age=0' in h]
    assert any('pangea_session=' in h for h in expired)
    assert any('pangea_pending=' in h for h in expired)


def test_status_tells_the_lock_screen_what_is_possible(client):
    body = client.get('/api/auth/status').json()
    assert body == {
        'enrolled': False,
        'enrollmentOpen': True,
        'authenticated': False,
        'user': None,
        'awaitingTotp': False,
        'totpEnrolled': False,
    }
    sign_in(client)
    assert client.get('/api/auth/status').json()['authenticated'] is True
