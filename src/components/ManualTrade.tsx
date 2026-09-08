import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitManualOrder, type ManualOrder } from '../lib/api'
import { fmtRatio } from '../lib/format'
import type { Account, Position } from '../lib/types'
import { Label, Stamp } from './ui'

const SYMBOLS = ['MES', 'MNQ', 'M6E', 'MGC'] as const
const RISKS: ManualOrder['riskPct'][] = [0.25, 0.5, 0.75, 1]
const STOPS: ManualOrder['stop'][] = ['tight', 'normal', 'wide']
const STOP_ATR: Record<ManualOrder['stop'], string> = { tight: '0.8× ATR', normal: '1.4× ATR', wide: '2.2× ATR' }

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

  // Sizing, margin and the correlation matrix live in the engine; this modal shows only what
  // the snapshot already states, so nothing on screen is a number the app invented.
  const heldElsewhere = positions.filter((p) => p.side !== 'flat' && p.symbol !== symbol).map((p) => p.symbol)

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
          <div className="flex items-center justify-between">
            <Label>Context</Label>
            <Stamp asOf={account.asOf} source={account.source} />
          </div>
          <div className="flex justify-between">
            <span>Risk used now</span>
            <span className="tnum text-pg-text">{fmtRatio(account.riskUsed)}</span>
          </div>
          <div className="flex justify-between">
            <span>Requested risk</span>
            <span className="tnum text-pg-text">{riskPct.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between">
            <span>Also held</span>
            <span className="text-pg-text">{heldElsewhere.length ? heldElsewhere.join(', ') : 'nothing'}</span>
          </div>
          <div className="flex justify-between">
            <span>Day return</span>
            <span className="tnum text-pg-text">{fmtRatio(account.returns.day, 2)}</span>
          </div>
          <p className="pt-1 text-[11px] text-pg-mute">
            Sizing, margin and correlation checks run in the engine. It sizes and may reject this order.
          </p>
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
