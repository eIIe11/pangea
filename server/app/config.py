from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Every secret comes from the environment. Nothing here has a usable default."""

    model_config = SettingsConfigDict(env_prefix='PANGEA_', env_file='.env', extra='ignore')

    # Signs session cookies. Rotating it logs everyone out, which is the point.
    session_secret: str = ''
    session_ttl_seconds: int = 12 * 60 * 60

    # WebAuthn is bound to one origin by design: a passkey registered for the real app
    # cannot be replayed from anywhere else.
    rp_id: str = 'localhost'
    rp_name: str = 'Pangea'
    origin: str = 'http://localhost:5173'

    # Browsers only send a cross-site session cookie when it is Secure + SameSite=None,
    # which is the deployed case (Netlify frontend, separate API host).
    cookie_secure: bool = True
    cookie_samesite: str = 'none'
    cookie_domain: str | None = None

    # Enrolling the first passkey needs this code, so the deployed API cannot be claimed
    # by whoever finds the URL first.
    enroll_code: str = ''

    db_path: Path = Path('pangea.db')

    # Broker stays off until it is configured explicitly; an unset broker refuses orders
    # rather than pretending to route them.
    ibkr_host: str = ''
    ibkr_port: int = 0
    ibkr_client_id: int = 1
    ibkr_paper: bool = True

    watchlist: str = 'MES=F,MNQ=F,M6E=F,MGC=F'

    @property
    def symbols(self) -> list[str]:
        return [s.strip() for s in self.watchlist.split(',') if s.strip()]

    @property
    def broker_configured(self) -> bool:
        return bool(self.ibkr_host) and self.ibkr_port > 0


@lru_cache
def settings() -> Settings:
    return Settings()
