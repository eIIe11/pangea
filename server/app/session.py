"""Signed, httpOnly cookie sessions.

The browser never holds anything it can forge: the cookie is a signed, expiring token and
the server re-reads the user on every request. Nothing about the session lives in JS-readable
storage, so an XSS bug cannot lift a trading session out of the page.
"""

from fastapi import Request, Response
from itsdangerous import BadSignature, SignatureExpired, TimestampSigner

from .config import Settings

COOKIE = 'pangea_session'
PENDING_COOKIE = 'pangea_pending'
PENDING_TTL_SECONDS = 300


class SessionError(Exception):
    pass


def _signer(settings: Settings, salt: str = 'pangea-session') -> TimestampSigner:
    if not settings.session_secret:
        raise SessionError('PANGEA_SESSION_SECRET is not set; refusing to issue sessions')
    return TimestampSigner(settings.session_secret, salt=salt)


def issue_pending(response: Response, settings: Settings, user_id: str) -> None:
    """Half a login: the passkey checked out, the authenticator code has not."""
    token = _signer(settings, 'pangea-pending').sign(user_id).decode()
    response.set_cookie(
        PENDING_COOKIE,
        token,
        max_age=PENDING_TTL_SECONDS,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,  # type: ignore[arg-type]
        domain=settings.cookie_domain,
        path='/',
    )


def read_pending(request: Request, settings: Settings) -> str | None:
    token = request.cookies.get(PENDING_COOKIE)
    if not token:
        return None
    try:
        return (
            _signer(settings, 'pangea-pending').unsign(token, max_age=PENDING_TTL_SECONDS).decode()
        )
    except (BadSignature, SignatureExpired):
        return None


def issue(response: Response, settings: Settings, user_id: str) -> None:
    token = _signer(settings).sign(user_id).decode()
    response.set_cookie(
        COOKIE,
        token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,  # type: ignore[arg-type]
        domain=settings.cookie_domain,
        path='/',
    )


def clear(response: Response, settings: Settings) -> None:
    for name in (COOKIE, PENDING_COOKIE):
        response.delete_cookie(
            name,
            httponly=True,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,  # type: ignore[arg-type]
            domain=settings.cookie_domain,
            path='/',
        )


def read(request: Request, settings: Settings) -> str | None:
    token = request.cookies.get(COOKIE)
    if not token:
        return None
    try:
        return _signer(settings).unsign(token, max_age=settings.session_ttl_seconds).decode()
    except (BadSignature, SignatureExpired):
        return None
