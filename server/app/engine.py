"""Authenticated engine endpoints: market data, account snapshot, controls, manual orders.

The contract the app relies on (see src/lib/api.ts):
* a control or order answers with a boolean `accepted` and, when refused, a `reason`;
* a snapshot either carries real, timestamped state or fails — it never fills gaps in.

There is deliberately no endpoint for changing a risk limit: limits live in versioned
config and need a restart, because a limit a phone can raise is not a limit.
"""

import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .broker import Broker, BrokerNotConnected
from .config import Settings
from .deps import get_settings, require_user
from .market import quotes
from .store import User

router = APIRouter(prefix='/api', tags=['engine'])

ControlAction = str


class ControlBody(BaseModel):
    action: str = Field(pattern=r'^(halve|pause_entries|stop_everything|resume)$')


class ManualOrderBody(BaseModel):
    symbol: str = Field(min_length=1, max_length=12)
    side: str = Field(pattern=r'^(long|short)$')
    riskPct: float = Field(gt=0, le=1)
    stop: str = Field(pattern=r'^(tight|normal|wide)$')


def _now() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def get_broker(settings: Settings = Depends(get_settings)) -> Broker:
    return Broker(settings)


@router.get('/market/quotes')
async def market_quotes(
    settings: Settings = Depends(get_settings),
    _: User = Depends(require_user),
) -> dict:
    return await quotes(settings.symbols)


@router.get('/broker/status')
def broker_status(
    broker: Broker = Depends(get_broker),
    _: User = Depends(require_user),
) -> dict:
    status = broker.status()
    return {
        'connected': status.connected,
        'paper': status.paper,
        'reason': status.reason,
        'asOf': _now(),
    }


@router.get('/snapshot')
def snapshot(
    broker: Broker = Depends(get_broker),
    _: User = Depends(require_user),
) -> dict:
    try:
        broker.require_connected()
    except BrokerNotConnected as error:
        # 503 with the reason, not a plausible-looking account: the app shows the refusal.
        raise HTTPException(503, f'No account state available. {error.reason}') from error
    raise HTTPException(503, 'No account state available.')


@router.post('/control')
def control(
    body: ControlBody,
    broker: Broker = Depends(get_broker),
    _: User = Depends(require_user),
) -> dict:
    try:
        broker.require_connected()
    except BrokerNotConnected as error:
        return {'accepted': False, 'reason': f'{error.reason} Nothing was sent.'}
    return {'accepted': False, 'reason': 'Controls are not wired to a live engine yet.'}


@router.post('/orders/manual')
def manual_order(
    body: ManualOrderBody,
    broker: Broker = Depends(get_broker),
    _: User = Depends(require_user),
) -> dict:
    try:
        broker.require_connected()
    except BrokerNotConnected as error:
        return {'accepted': False, 'reason': f'{error.reason} Nothing was routed.'}
    return {'accepted': False, 'reason': 'Order routing is not enabled yet.'}
