import { useState } from 'react'
import { Card, Dot, Label, Row, StageBadge } from '../components/ui'
import { fmtNum, fmtRatio, fmtSignedMoney, pnlClass } from '../lib/format'
import type { Strategy } from '../lib/types'

function DivergenceBar({ live, backtest }: { live: number; backtest: number }) {
  const ratio = backtest === 0 ? 0 : live / backtest
  const width = Math.max(0, Math.min(1, ratio))
  const bad = ratio < 0.5
  return (
    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-pg-line" title="live Sharpe as a share of backtest">
      <div className={`h-full ${bad ? 'bg-pg-down' : 'bg-pg-accent'}`} style={{ width: `${width * 100}%` }} />
    </div>
  )
}

function Detail({ strategy }: { strategy: Strategy }) {
  const { gates, overrides90d, decay } = strategy
  return (
    <div className="space-y-3 border-t border-pg-line px-4 py-3 text-xs text-pg-mute">
      <div className="grid grid-cols-3 gap-2">
        {[
          ['DSR', fmtNum(gates.dsr), gates.dsr > 0],
          ['PBO', fmtNum(gates.pbo), gates.pbo < 0.5],
          ['t-stat', fmtNum(gates.tStat), gates.tStat > 3],
        ].map(([label, value, pass]) => (
          <div key={String(label)}>
            <div className="text-[10px] tracking-[0.1em] uppercase">{label}</div>
            <div className={`tnum text-sm ${pass ? 'text-pg-text' : 'text-pg-down'}`}>{value}</div>
          </div>
        ))}
      </div>

      <div>
        <Label>Overrides · rolling 90 days</Label>
        <div className="mt-1 space-y-1">
          <Row>
            <span>Discretionary actions</span>
            <span className="tnum text-pg-text">{overrides90d.count}</span>
          </Row>
          <Row>
            <span>Your decisions vs the unmodified system</span>
            <span className={`tnum ${pnlClass(overrides90d.pnlVsSystemUsd)}`}>
              {fmtSignedMoney(overrides90d.pnlVsSystemUsd)}
            </span>
          </Row>
          <Row>
            <span>Hit rate</span>
            <span className="tnum text-pg-text">{fmtRatio(overrides90d.hitRate)}</span>
          </Row>
        </div>
      </div>

      <div>
        <Label>Decay monitors</Label>
        <div className="mt-1 space-y-1">
          <Row>
            <span>Signal IC trend</span>
            <span className={`tnum ${decay.icTrend < 0 ? 'text-pg-down' : 'text-pg-text'}`}>{fmtNum(decay.icTrend, 4)}</span>
          </Row>
          <Row>
            <span>Slippage drift vs model</span>
            <span className="tnum text-pg-text">{fmtNum(decay.slippageDrift)}×</span>
          </Row>
          {decay.deallocated && <p className="text-pg-down">Auto-de-allocated on a decay signal. Flagged for review.</p>}
        </div>
      </div>
    </div>
  )
}

export function Strategies({ strategies }: { strategies: Strategy[] }) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <Label>Strategies</Label>
      {strategies.map((strategy) => (
        <Card key={strategy.id}>
          <button type="button" onClick={() => setOpen(open === strategy.id ? null : strategy.id)} className="w-full px-4 py-3 text-left">
            <Row>
              <span className="flex items-center gap-2">
                <Dot health={strategy.health} />
                <span className="text-sm">{strategy.name}</span>
                <StageBadge stage={strategy.stage} />
              </span>
              <span className="tnum text-sm text-pg-mute">{fmtRatio(strategy.allocation)}</span>
            </Row>
            <Row className="mt-2 text-xs text-pg-mute">
              <span className="tnum">
                live {fmtNum(strategy.liveSharpe)} · backtest {fmtNum(strategy.backtestSharpe)}
              </span>
              <DivergenceBar live={strategy.liveSharpe} backtest={strategy.backtestSharpe} />
            </Row>
          </button>
          {open === strategy.id && <Detail strategy={strategy} />}
        </Card>
      ))}
      <p className="px-1 text-[11px] leading-relaxed text-pg-mute">
        Allocation, limits and parameters live in version-controlled config and need a service restart to change. This screen
        reports; it cannot loosen anything.
      </p>
    </div>
  )
}
