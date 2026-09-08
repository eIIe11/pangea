import { useState } from 'react'
import { Card, Dot, Label, MeterRow, Row } from '../components/ui'
import { Coin } from '../components/Coin'
import { Controls } from '../components/Controls'
import { EquityChart } from '../components/EquityChart'
import { ManualTrade } from '../components/ManualTrade'
import { fmtMoney, fmtOrdinal, fmtPct, fmtSignedMoney, pnlClass } from '../lib/format'
import { sessionLabel } from '../lib/sessions'
import type { Account, Position } from '../lib/types'

function PositionRow({ position }: { position: Position }) {
  const flat = position.side === 'flat'
  return (
    <Row className="border-t border-pg-line/60 px-4 py-3 first:border-t-0">
      <span className="flex items-baseline gap-3">
        <span className="tnum w-12 text-sm">{position.symbol}</span>
        <span className="text-xs text-pg-mute">{flat ? 'flat' : `${position.side} ${position.contracts}`}</span>
      </span>
      <span className="flex items-center gap-3">
        {!flat && position.restingStop === null && (
          <span className="text-[10px] tracking-wide text-pg-down uppercase">no resting stop</span>
        )}
        <span className={`tnum text-sm ${flat ? 'text-pg-mute' : pnlClass(position.pnlUsd)}`}>
          {flat ? '—' : fmtSignedMoney(position.pnlUsd)}
        </span>
        <Dot health={position.health} hollow={flat} />
      </span>
    </Row>
  )
}

export function Now({ account, positions }: { account: Account; positions: Position[] }) {
  const [manualOpen, setManualOpen] = useState(false)
  const held = positions.filter((p) => p.side !== 'flat').length
  const uncovered = positions.filter((p) => p.side !== 'flat' && p.restingStop === null).length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Coin size={64} />
        <div>
          <h1 className="text-lg font-semibold">Welcome, Elle</h1>
          <p className="text-xs text-pg-mute">{sessionLabel()}</p>
        </div>
      </div>

      <Card className="p-4">
        <Row className="items-end">
          <div>
            <div className="tnum text-4xl leading-none font-semibold">{fmtMoney(account.equityUsd)}</div>
            <div className="tnum mt-1 text-xs text-pg-mute">
              {fmtMoney(account.equityRef, account.referenceCurrency)} {account.referenceCurrency}
            </div>
          </div>
          <div className="text-right">
            <div className={`tnum text-lg ${pnlClass(account.returns.day)}`}>{fmtPct(account.returns.day)}</div>
            <div className="text-[11px] text-pg-mute">today</div>
          </div>
        </Row>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-pg-line pt-3 text-center">
          {(['week', 'month', 'inception'] as const).map((key) => (
            <div key={key}>
              <div className={`tnum text-sm ${pnlClass(account.returns[key])}`}>{fmtPct(account.returns[key])}</div>
              <div className="text-[10px] tracking-[0.1em] text-pg-mute uppercase">
                {key === 'inception' ? 'all' : key}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <EquityChart points={account.equityCurve} />
          <div className="mt-1 flex justify-between text-[10px] tracking-[0.1em] text-pg-mute uppercase">
            <span>90 days</span>
            <span>benchmark ghosted</span>
          </div>
        </div>
      </Card>

      <Card>
        <Row className="px-4 pt-3">
          <Label>Positions</Label>
          <span className="tnum text-sm text-pg-mute">{held}</span>
        </Row>
        <div className="mt-2">
          {positions.map((position) => (
            <PositionRow key={position.symbol} position={position} />
          ))}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <MeterRow label="Risk used" value={account.riskUsed} />
        <MeterRow label="Cost / gross" value={account.costOfGross} warnAbove={0.4} />
        <Row>
          <span className="text-sm text-pg-mute">Stop coverage</span>
          <span className={`tnum text-sm ${uncovered ? 'text-pg-down' : ''}`}>
            {account.stopCoverage.covered}/{account.stopCoverage.total} resting at exchange
          </span>
        </Row>
        <Row>
          <span className="text-sm text-pg-mute">Account FX ({account.referenceCurrency} reference)</span>
          <span className="tnum text-sm">
            {account.fxExposure.hedged ? `hedged · ${account.fxExposure.hedgeInstrument}` : 'unhedged'}
          </span>
        </Row>
      </Card>

      {account.drawdown.fromPeak > 0 && (
        <Card className="p-4 text-sm leading-relaxed">
          <Label>Drawdown context</Label>
          <p className="mt-2 text-pg-mute">
            Down <span className="tnum text-pg-text">{(account.drawdown.fromPeak * 100).toFixed(1)}%</span>.{' '}
            {fmtOrdinal(account.drawdown.percentile)} percentile of this system's historical drawdowns. Median recovery{' '}
            {account.drawdown.medianRecoveryWeeks[0]}–{account.drawdown.medianRecoveryWeeks[1]} weeks. Circuit breaker at{' '}
            <span className="tnum text-pg-text">{(account.drawdown.breakerAt * 100).toFixed(0)}%</span>.
          </p>
        </Card>
      )}

      <Controls engine={account.engine} />

      <button
        type="button"
        onClick={() => setManualOpen(true)}
        className="w-full rounded-xl border border-pg-line py-3 text-xs tracking-[0.12em] text-pg-mute uppercase"
      >
        Manual trade
      </button>

      {manualOpen && <ManualTrade account={account} positions={positions} onClose={() => setManualOpen(false)} />}
    </div>
  )
}
