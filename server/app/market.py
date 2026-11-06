"""Real quotes, cached briefly.

The app renders nothing without a timestamp, so a quote carries the exchange time it was
true and the app decides for itself whether that is stale. Failures propagate: a missing
quote is reported as missing rather than carried forward as if it were current.
"""

import time
from dataclasses import asdict, dataclass

import httpx

CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}'
CACHE_TTL_SECONDS = 15.0
TIMEOUT_SECONDS = 6.0


class MarketError(Exception):
    pass


@dataclass(frozen=True)
class Quote:
    symbol: str
    price: float
    previousClose: float
    change: float
    changePct: float
    currency: str
    asOf: str
    source: str = 'live'


_cache: dict[str, tuple[float, Quote]] = {}


async def quote(symbol: str, client: httpx.AsyncClient) -> Quote:
    cached = _cache.get(symbol)
    if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]
    try:
        response = await client.get(
            CHART_URL.format(symbol=symbol),
            params={'range': '5d', 'interval': '1d'},
            timeout=TIMEOUT_SECONDS,
            headers={'user-agent': 'pangea/0.1'},
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise MarketError(f'{symbol}: {error}') from error

    results = (payload.get('chart') or {}).get('result') or []
    if not results:
        raise MarketError(f'{symbol}: no data in response')
    meta = results[0].get('meta') or {}
    price = meta.get('regularMarketPrice')
    previous = meta.get('chartPreviousClose') or meta.get('previousClose')
    stamp = meta.get('regularMarketTime')
    if price is None or previous is None or stamp is None:
        raise MarketError(f'{symbol}: incomplete quote')

    change = float(price) - float(previous)
    result = Quote(
        symbol=symbol,
        price=float(price),
        previousClose=float(previous),
        change=change,
        changePct=change / float(previous) if previous else 0.0,
        currency=meta.get('currency', 'USD'),
        asOf=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(int(stamp))),
    )
    _cache[symbol] = (time.monotonic(), result)
    return result


async def quotes(symbols: list[str]) -> dict:
    """Partial success is reported as partial: quoted symbols and failures, side by side."""
    quoted: list[dict] = []
    failed: dict[str, str] = {}
    async with httpx.AsyncClient() as client:
        for symbol in symbols:
            try:
                quoted.append(asdict(await quote(symbol, client)))
            except MarketError as error:
                failed[symbol] = str(error)
    return {
        'quotes': quoted,
        'failed': failed,
        'asOf': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'source': 'live',
    }
