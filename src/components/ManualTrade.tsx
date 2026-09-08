import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitManualOrder, type ManualOrder } from '../lib/api'
import { fmtMoney, fmtRatio } from '../lib/format'
import type { Account, Position } from '../lib/types'
import { Label } from './ui'

const SYMBOLS = ['MES', 'MNQ', 'M6E', 'MGC'] as const
const RISKS: ManualOrder['riskPct'][] = [0.25, 0.5, 0.75, 1]
const STOPS: ManualOrder['stop'][] = ['tight', 'normal', 'wide']
const STOP_ATR: Record<ManualOrder['stop'], string> = { tight: '0.8× ATR', normal: '1.4× ATR', wide: '2.2× ATR' }
const DAILY_LOSS_LIMIT = 0.02

function Choice<T extends string | number>({
  options,
  value,
  onChange,
  render,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  render?: (v: T) => string
}) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={String(option)}
          type="button"
          onClick={() => onChange(option)}
          className={`flex-1 rounded-lg border py-2 text-xs uppercase ${
            option === value ? 'border-pg-accent bg-pg-accent/15 text-pg-text' : 'border-pg-line text-pg-mute'
          }`}
        >
          {render ? render(option) : String(option)}
        </button>
      ))}
    </div>
  )
}

/**
 * A modal, not a screen. Every number is chosen from an engine-bounded set — free-text
 * sizing and stops fail exactly when the operator is emotional (§17). Routes through the
 * same risk checks as an automated order; nothing here can override a limit.
 */
export function ManualTrade({
  account,
  positions,
  onClose,
}: {
  account: Account
  positions: Position[]
  onClose: () => void
}) {
  const [symbol, setSymbol] = useState<string>('MES')
  const [side, setSide] = useState<ManualOrder['side']>('long')
  const [riskPct, setRiskPct] = useState<ManualOrder['riskPct']>(0.5)
  const [stop, setStop] = useState<ManualOrder['stop']>('normal')
  const queryClient = useQueryClient()

  const submit = useMutation({
    mutationFn: () => submitManualOrder({ symbol, side, riskPct, stop }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['snapshot'] }),
  })

  const riskFraction = riskPct / 100
  const resultingRisk = account.riskUsed + riskFraction / 0.02
  const dailyBudgetLeft = Math.max(0, DAILY_LOSS_LIMIT + Math.min(0, account.returns.day)) - riskFraction
  const correlated = positions.filter((p) => p.side !== 'flat' && p.symbol !== symbol).map((p) => p.symbol)

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 sm:items-center sm:justify-center" role="dialog" aria-modal>
      <div className="w-full space-y-4 rounded-t-3xl border border-pg-line bg-pg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <Label>Manual trade</Label>
          <button type="button" onClick={onClose} className="text-sm text-pg-mute">
            Close
          </button>
        </div>

        <Choice options={SYMBOLS} value={symbol} onChange={setSymbol} />
        <Choice options={['long', 'short'] as const} value={side} onChange={setSide} />

        <div className="space-y-2">
          <Label>Risk per trade</Label>
          <Choice options={RISKS} value={riskPct} onChange={setRiskPct} render={(r) => `${r}%`} />
        </div>

        <div className="space-y-2">
          <Label>Stop — volatility derived</Label>
          <Choice options={STOPS} value={stop} onChange={setStop} render={(s) => `${s} · ${STOP_ATR[s]}`} />
        </div>

        <div className="space-y-1 rounded-xl border border-pg-line p-3 text-xs text-pg-mute">
          <Label>Pre-trade impact</Label>
          <div className="flex justify-between">
            <span>Portfolio risk after fill</span>
            <span className="tnum text-pg-text">{fmtRatio(Math.min(1, resultingRisk))}</span>
          </div>
          <div className="flex justify-between">
            <span>Correlates with</span>
            <span className="text-pg-text">{correlated.length ? correlated.join(', ') : 'nothing held'}</span>
          </div>
          <div className="flex justify-between">
            <span>Daily loss budget left</span>
            <span className="tnum text-pg-text">{fmtRatio(dailyBudgetLeft, 2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Margin buffer after fill</span>
            <span className="tnum text-pg-text">{fmtMoney(account.equityUsd * 0.72)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => submit.mutate()}
          disabled={submit.isPending}
          className="w-full rounded-xl border border-pg-accent bg-pg-accent/15 py-3 text-sm font-semibold tracking-[0.12em] uppercase disabled:opacity-40"
        >
          Confirm
        </button>

        {submit.data && (
          <p className={`text-center text-xs ${submit.data.accepted ? 'text-pg-up' : 'text-pg-gold'}`}>
            {submit.data.accepted ? 'Accepted — routed through the risk engine.' : submit.data.reason}
          </p>
        )}
        {submit.isError && <p className="text-center text-xs text-pg-down">Rejected by the risk engine or unreachable.</p>}
      </div>
    </div>
  )
}
