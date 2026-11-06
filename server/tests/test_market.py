import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import market

CHART = {
    'chart': {
        'result': [
            {
                'meta': {
                    'regularMarketPrice': 5820.25,
                    'chartPreviousClose': 5800.0,
                    'regularMarketTime': 1_757_000_000,
                    'currency': 'USD',
                }
            }
        ]
    }
}


def transport(payload: dict, status: int = 200) -> httpx.MockTransport:
    return httpx.MockTransport(lambda request: httpx.Response(status, json=payload))


@pytest.fixture(autouse=True)
def no_cache():
    market._cache.clear()
    yield
    market._cache.clear()


@pytest.mark.anyio
async def test_quote_carries_the_exchange_time_and_change():
    async with httpx.AsyncClient(transport=transport(CHART)) as client:
        quote = await market.quote('MES=F', client)
    assert quote.price == 5820.25
    assert round(quote.change, 2) == 20.25
    assert quote.asOf.endswith('Z')
    assert quote.source == 'live'


@pytest.mark.anyio
@pytest.mark.parametrize(
    'payload',
    [{}, {'chart': {'result': []}}, {'chart': {'result': [{'meta': {'regularMarketPrice': 1.0}}]}}],
)
async def test_an_incomplete_quote_is_an_error_not_a_guess(payload):
    async with httpx.AsyncClient(transport=transport(payload)) as client:
        with pytest.raises(market.MarketError):
            await market.quote('MES=F', client)


@pytest.mark.anyio
async def test_a_failing_symbol_is_reported_not_hidden():
    async with httpx.AsyncClient(transport=transport(CHART, status=500)) as client:
        with pytest.raises(market.MarketError):
            await market.quote('MES=F', client)
