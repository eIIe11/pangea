import { useMemo, useState } from 'react'
import { Card, Empty, Label, Row } from '../components/ui'
import { tradesCsv } from '../lib/api'
import { fmtClock, fmtDate, fmtNum } from '../lib/format'
import type { Trade } from '../lib/types'

function download(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `pangea-trades-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function Trades({ trades }: { trades: Trade[] }) {
  const [symbol, setSymbol] = useState<string>('all')
  const symbols = useMemo(() => ['all', ...new Set(trades.map((t) => t.symbol))], [trades])
  const filtered = symbol === 'all' ? trades : trades.filter((t) => t.symbol === symbol)

  return (
    <div className="space-y-3">
      <Row>
        <Label>Trades</Label>
        <button type="button" onClick={() => download(tradesCsv(filtered))} className="text-[11px] tracking-[0.1em] text-pg-accent uppercase">
          Export CSV
        </button>
      </Row>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {symbols.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSymbol(option)}
            className={`rounded-lg border px-3 py-1.5 text-xs uppercase ${
              option === symbol ? 'border-pg-accent text-pg-text' : 'border-pg-line text-pg-mute'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <Empty>No trades in this filter.</Empty>}

      {filtered.map((trade) => (
        <Card key={trade.id} className="p-3">
          <Row className="text-sm">
            <span className="flex items-baseline gap-2">
              <span className="tnum">{trade.symbol}</span>
              <span className={trade.side === 'long' ? 'text-pg-up' : 'text-pg-down'}>{trade.side}</span>
              <span className="tnum text-pg-mute">×{trade.contracts}</span>
              {trade.manual && <span className="text-[10px] tracking-[0.1em] text-pg-gold uppercase">manual</span>}
            </span>
            <span className="tnum text-xs text-pg-mute">
              {fmtDate(trade.t)} {fmtClock(trade.t)}
            </span>
          </Row>
          <Row className="mt-1 text-xs text-pg-mute">
            <span className="tnum">fill {trade.fillPrice}</span>
            <span className={`tnum ${trade.slippageBps > trade.modelSlippageBps ? 'text-pg-down' : ''}`}>
              slippage {fmtNum(trade.slippageBps)} bps vs model {fmtNum(trade.modelSlippageBps)}
            </span>
          </Row>
          <p className="mt-2 text-xs leading-relaxed text-pg-mute">{trade.reason}</p>
        </Card>
      ))}
    </div>
  )
}
