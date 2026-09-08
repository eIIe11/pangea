"""Broker boundary.

Nothing here invents an account. Until an IBKR gateway is configured and reachable, every
call reports that it is not connected, and the API refuses orders instead of accepting them
into a void — an order the operator believes was routed is worse than a visible refusal.

Connecting for real means pointing PANGEA_IBKR_HOST/PORT at a running IB Gateway or TWS
(paper port 4002/7497, live 4001/7496) and installing the gateway-side dependency; the
`connect` seam below is where that client goes.
"""

from dataclasses import dataclass

from .config import Settings


class BrokerNotConnected(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class BrokerStatus:
    connected: bool
    paper: bool
    reason: str | None


class Broker:
    """A single seam: everything money-touching goes through one object that knows whether
    it is actually talking to a broker."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def status(self) -> BrokerStatus:
        if not self._settings.broker_configured:
            return BrokerStatus(
                connected=False,
                paper=self._settings.ibkr_paper,
                reason='No IBKR gateway configured (PANGEA_IBKR_HOST/PANGEA_IBKR_PORT unset).',
            )
        return BrokerStatus(
            connected=False,
            paper=self._settings.ibkr_paper,
            reason=(
                f'IBKR gateway configured at {self._settings.ibkr_host}:{self._settings.ibkr_port} '
                'but the client is not connected yet.'
            ),
        )

    def require_connected(self) -> None:
        status = self.status()
        if not status.connected:
            raise BrokerNotConnected(status.reason or 'broker not connected')
