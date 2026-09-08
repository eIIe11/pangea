const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const money2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function fmtMoney(value: number, currency = 'USD'): string {
  const symbol = currency === 'USD' ? '$' : currency === 'AUD' ? 'A$' : '฿'
  const sign = value < 0 ? '−' : ''
  return `${sign}${symbol}${money.format(Math.abs(value))}`
}

export function fmtSignedMoney(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}$${money.format(Math.abs(value))}`
}

export function fmtPct(fraction: number, digits = 1): string {
  const sign = fraction > 0 ? '+' : fraction < 0 ? '−' : ''
  return `${sign}${Math.abs(fraction * 100).toFixed(digits)}%`
}

export function fmtRatio(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`
}

export function fmtNum(value: number, digits = 2): string {
  return digits === 2 ? money2.format(value) : value.toFixed(digits)
}

export function fmtOrdinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/** Age of a timestamp in words. Deliberately blunt — staleness is a safety signal. */
export function fmtAge(asOf: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(asOf).getTime()) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export const STALE_AFTER_MS = 60_000

export function isStale(asOf: string, now: number = Date.now()): boolean {
  return now - new Date(asOf).getTime() > STALE_AFTER_MS
}

export function fmtClock(t: string): string {
  return new Date(t).toISOString().slice(11, 16) + 'Z'
}

export function fmtDate(t: string): string {
  return new Date(t).toISOString().slice(0, 10)
}

export function pnlClass(value: number): string {
  if (value > 0) return 'text-pg-up'
  if (value < 0) return 'text-pg-down'
  return 'text-pg-mute'
}
