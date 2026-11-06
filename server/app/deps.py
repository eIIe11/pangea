from fastapi import Depends, HTTPException, Request

from .config import Settings
from .config import settings as load_settings
from .session import read
from .store import Store, User


def get_settings() -> Settings:
    return load_settings()


def get_store(request: Request) -> Store:
    return request.app.state.store


def require_user(
    request: Request,
    settings: Settings = Depends(get_settings),
    store: Store = Depends(get_store),
) -> User:
    """Every endpoint that can see money or move it goes through here."""
    user_id = read(request, settings)
    user = store.user(user_id) if user_id else None
    if user is None:
        raise HTTPException(401, 'sign in with your passkey')
    return user
