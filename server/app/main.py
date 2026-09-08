from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import auth, engine
from .config import settings
from .store import Store


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.store = Store(settings().db_path)
    try:
        yield
    finally:
        app.state.store.close()


def create_app() -> FastAPI:
    config = settings()
    app = FastAPI(title='Pangea engine API', version='0.1.0', lifespan=lifespan)
    # Exactly one origin, with credentials: a wildcard cannot carry a session cookie, and
    # a session that any origin could use would not be a session.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[config.origin],
        allow_credentials=True,
        allow_methods=['GET', 'POST'],
        allow_headers=['content-type'],
    )
    app.include_router(auth.router)
    app.include_router(engine.router)

    @app.get('/api/health')
    def health() -> dict:
        return {
            'ok': True,
            'rpId': config.rp_id,
            'origin': config.origin,
            'brokerConfigured': config.broker_configured,
        }

    return app


app = create_app()
