"""Real authentication: a platform passkey (Face ID / Touch ID / Windows Hello) plus,
when enrolled, a Google Authenticator code.

Two properties matter here and neither can be achieved in the browser alone, which is why
the app's keypad is only a device gate:

* the passkey's private key never leaves the phone's secure enclave and the signature is
  verified server-side against a stored public key, so nothing in the bundle can forge it;
* the session is a signed httpOnly cookie, so the page's JavaScript cannot read or mint one.

Enrolment needs PANGEA_ENROLL_CODE, so a deployed API cannot be claimed by a stranger.
"""

import secrets
import time
from base64 import b64encode
from dataclasses import dataclass
from io import BytesIO

import pyotp
import qrcode
import webauthn
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from webauthn.helpers.exceptions import (
    InvalidAuthenticationResponse,
    InvalidJSONStructure,
    InvalidRegistrationResponse,
)
from webauthn.helpers.structs import (
    AuthenticatorAttachment,
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from .config import Settings
from .deps import get_settings, get_store, require_user
from .session import clear, issue, issue_pending, read, read_pending
from .store import Credential, Store, User

router = APIRouter(prefix='/api/auth', tags=['auth'])

CHALLENGE_TTL_SECONDS = 300


@dataclass
class _Challenge:
    value: bytes
    user_id: str
    expires_at: float


# Challenges are single-use and short-lived, so they live in memory: losing them on restart
# only means re-tapping the prompt, and never accepting a replayed one is the whole point.
_challenges: dict[str, _Challenge] = {}


def _put_challenge(key: str, value: bytes, user_id: str) -> None:
    now = time.time()
    for stale in [k for k, c in _challenges.items() if c.expires_at < now]:
        del _challenges[stale]
    _challenges[key] = _Challenge(value, user_id, now + CHALLENGE_TTL_SECONDS)


def _take_challenge(key: str) -> _Challenge:
    challenge = _challenges.pop(key, None)
    if challenge is None or challenge.expires_at < time.time():
        raise HTTPException(400, 'challenge expired; start again')
    return challenge


class EnrollStart(BaseModel):
    user_id: str = Field(min_length=1, max_length=64, pattern=r'^[a-z0-9_.-]+$')
    display_name: str = Field(min_length=1, max_length=64)
    enroll_code: str


class VerifyBody(BaseModel):
    user_id: str = Field(min_length=1, max_length=64, pattern=r'^[a-z0-9_.-]+$')
    credential: dict
    label: str = Field(default='this device', max_length=64)


class LoginStart(BaseModel):
    user_id: str = Field(min_length=1, max_length=64, pattern=r'^[a-z0-9_.-]+$')


class TotpBody(BaseModel):
    code: str = Field(min_length=6, max_length=8, pattern=r'^\d{6,8}$')


def _check_enroll_code(settings: Settings, supplied: str) -> None:
    if not settings.enroll_code:
        raise HTTPException(503, 'PANGEA_ENROLL_CODE is not set; enrolment is closed')
    if not secrets.compare_digest(settings.enroll_code, supplied):
        raise HTTPException(403, 'wrong enrolment code')


@router.get('/status')
def status(
    request: Request,
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
) -> dict:
    """What the lock screen needs before showing anything: who can log in, and how."""
    user_id = read(request, settings)
    user = store.user(user_id) if user_id else None
    pending_id = read_pending(request, settings)
    pending = store.user(pending_id) if pending_id else None
    return {
        'enrolled': store.user_count() > 0,
        'enrollmentOpen': bool(settings.enroll_code),
        'authenticated': user is not None,
        'user': user.display_name if user else None,
        'awaitingTotp': pending is not None,
        'totpEnrolled': bool(pending and pending.totp_verified),
    }


@router.post('/passkey/enroll/options')
def passkey_enroll_options(
    body: EnrollStart,
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
) -> dict:
    _check_enroll_code(settings, body.enroll_code)
    user = store.upsert_user(body.user_id, body.display_name)
    options = webauthn.generate_registration_options(
        rp_id=settings.rp_id,
        rp_name=settings.rp_name,
        user_id=user.id.encode(),
        user_name=user.id,
        user_display_name=user.display_name,
        # Face ID / Touch ID / Hello, and a resident key so the phone offers it by name.
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=AuthenticatorAttachment.PLATFORM,
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        exclude_credentials=[
            PublicKeyCredentialDescriptor(id=c.id) for c in store.credentials(user.id)
        ],
    )
    _put_challenge(f'reg:{user.id}', options.challenge, user.id)
    return {'options': webauthn.options_to_json(options)}


@router.post('/passkey/enroll/verify')
def passkey_enroll_verify(
    body: VerifyBody,
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
) -> dict:
    challenge = _take_challenge(f'reg:{body.user_id}')
    try:
        verified = webauthn.verify_registration_response(
            credential=body.credential,
            expected_challenge=challenge.value,
            expected_rp_id=settings.rp_id,
            expected_origin=settings.origin,
            require_user_verification=True,
        )
    except (InvalidRegistrationResponse, InvalidJSONStructure, ValueError) as error:
        raise HTTPException(400, f'passkey rejected: {error}') from error
    store.add_credential(
        Credential(
            id=verified.credential_id,
            user_id=body.user_id,
            public_key=verified.credential_public_key,
            sign_count=verified.sign_count,
            label=body.label,
        )
    )
    return {'registered': True, 'userId': body.user_id}


@router.post('/passkey/login/options')
def passkey_login_options(
    body: LoginStart,
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
) -> dict:
    credentials = store.credentials(body.user_id)
    if not credentials:
        raise HTTPException(404, 'no passkey enrolled for this user')
    options = webauthn.generate_authentication_options(
        rp_id=settings.rp_id,
        allow_credentials=[PublicKeyCredentialDescriptor(id=c.id) for c in credentials],
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    _put_challenge(f'auth:{body.user_id}', options.challenge, body.user_id)
    return {'options': webauthn.options_to_json(options)}


@router.post('/passkey/login/verify')
def passkey_login_verify(
    body: VerifyBody,
    response: Response,
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
) -> dict:
    challenge = _take_challenge(f'auth:{body.user_id}')
    raw_id = webauthn.base64url_to_bytes(str(body.credential.get('rawId', '')))
    credential = store.credential(raw_id)
    if credential is None or credential.user_id != body.user_id:
        raise HTTPException(404, 'unknown passkey')
    try:
        verified = webauthn.verify_authentication_response(
            credential=body.credential,
            expected_challenge=challenge.value,
            expected_rp_id=settings.rp_id,
            expected_origin=settings.origin,
            credential_public_key=credential.public_key,
            credential_current_sign_count=credential.sign_count,
            require_user_verification=True,
        )
    except (InvalidAuthenticationResponse, InvalidJSONStructure, ValueError) as error:
        raise HTTPException(401, f'passkey rejected: {error}') from error
    store.bump_sign_count(credential.id, verified.new_sign_count)

    user = store.user(body.user_id)
    assert user is not None
    if user.totp_verified:
        # Enrolled authenticator means the passkey is only the first factor.
        issue_pending(response, settings, user.id)
        return {'authenticated': False, 'totpRequired': True}
    issue(response, settings, user.id)
    return {'authenticated': True, 'totpRequired': False, 'user': user.display_name}


@router.post('/totp/enroll')
def totp_enroll(
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
    user: User = Depends(require_user),
) -> dict:
    """Hands back the otpauth URI and a QR to scan with Google Authenticator.

    The secret is only shown at enrolment and is not usable until a code from it verifies,
    so a half-finished scan cannot lock the account out.
    """
    secret = pyotp.random_base32()
    store.set_totp_secret(user.id, secret)
    uri = pyotp.TOTP(secret).provisioning_uri(name=user.display_name, issuer_name=settings.rp_name)
    image = qrcode.make(uri)
    buffer = BytesIO()
    image.save(buffer, format='PNG')
    return {
        'otpauthUri': uri,
        'qrPngBase64': b64encode(buffer.getvalue()).decode(),
        'verified': False,
    }


@router.post('/totp/enroll/verify')
def totp_enroll_verify(
    body: TotpBody,
    store: Store = Depends(get_store),
    user: User = Depends(require_user),
) -> dict:
    if not user.totp_secret:
        raise HTTPException(409, 'no authenticator enrolment in progress')
    if not pyotp.TOTP(user.totp_secret).verify(body.code, valid_window=1):
        raise HTTPException(401, 'that code does not match')
    store.mark_totp_verified(user.id)
    return {'verified': True}


@router.post('/totp/login')
def totp_login(
    body: TotpBody,
    request: Request,
    response: Response,
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
) -> dict:
    """Second factor: only reachable with a pending session from a verified passkey."""
    pending_id = read_pending(request, settings)
    if pending_id is None:
        raise HTTPException(401, 'no passkey step completed')
    user = store.user(pending_id)
    if user is None or not user.totp_secret or not user.totp_verified:
        raise HTTPException(409, 'no authenticator enrolled')
    if not pyotp.TOTP(user.totp_secret).verify(body.code, valid_window=1):
        raise HTTPException(401, 'that code does not match')
    issue(response, settings, user.id)
    return {'authenticated': True, 'user': user.display_name}


@router.get('/me')
def me(user: User = Depends(require_user)) -> dict:
    return {'userId': user.id, 'user': user.display_name, 'totpEnrolled': user.totp_verified}


@router.post('/logout')
def logout(response: Response, settings: Settings = Depends(get_settings)) -> dict:
    clear(response, settings)
    return {'authenticated': False}
