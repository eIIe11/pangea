import type { ReactNode } from 'react'
import type { Health, Stage } from '../lib/types'
import { fmtAge, fmtRatio, isStale } from '../lib/format'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-pg-line bg-pg-surface ${className}`}>{children}</section>
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-medium tracking-[0.14em] text-pg-mute uppercase">{children}</div>
}

export function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between gap-3 ${className}`}>{children}</div>
}

const DOT: Record<Health, string> = {
  ok: 'bg-pg-up',
  warn: 'bg-pg-gold',
  breach: 'bg-pg-down',
}

export function Dot({ health, hollow = false }: { health: Health; hollow?: boolean }) {
  return (
    <span
      role="img"
      aria-label={health}
      className={
        hollow
          ? 'inline-block size-2.5 rounded-full border border-pg-mute'
          : `inline-block size-2.5 rounded-full ${DOT[health]}`
      }
    />
  )
}

const STAGE_TEXT: Record<Stage, string> = {
  shadow: 'Shadow',
  capped: 'Capped',
  auto: 'Auto',
}

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className="rounded-md border border-pg-line px-1.5 py-0.5 text-[10px] tracking-[0.1em] text-pg-mute uppercase">
      {STAGE_TEXT[stage]}
    </span>
  )
}

export function Meter({ value, warnAbove }: { value: number; warnAbove?: number }) {
  const clamped = Math.max(0, Math.min(1, value))
  const over = warnAbove !== undefined && value > warnAbove
  return (
    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-pg-line" role="meter" aria-valuenow={Math.round(clamped * 100)}>
      <div className={`h-full ${over ? 'bg-pg-down' : 'bg-pg-accent'}`} style={{ width: `${clamped * 100}%` }} />
    </div>
  )
}

export function MeterRow({ label, value, warnAbove }: { label: string; value: number; warnAbove?: number }) {
  return (
    <Row>
      <span className="text-sm text-pg-mute">{label}</span>
      <span className="flex items-center gap-3">
        <span className="tnum text-sm">{fmtRatio(value)}</span>
        <Meter value={value} {...(warnAbove === undefined ? {} : { warnAbove })} />
      </span>
    </Row>
  )
}

/** No number is shown without its age. Past 60s it is called out, not quietly rendered. */
export function Stamp({ asOf, source }: { asOf: string; source: 'live' | 'demo' }) {
  const stale = isStale(asOf)
  return (
    <span className="flex items-center gap-2 text-[11px] text-pg-mute">
      {source === 'demo' && (
        <span className="rounded border border-pg-gold/50 px-1.5 py-0.5 text-[10px] tracking-[0.1em] text-pg-gold uppercase">
          Demo data
        </span>
      )}
      <span className={stale ? 'text-pg-down' : ''}>
        {stale ? 'stale · ' : ''}
        {fmtAge(asOf)}
      </span>
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-6 text-center text-sm text-pg-mute">{children}</div>
}
