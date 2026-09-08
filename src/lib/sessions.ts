/**
 * Session boundaries are declared in each venue's own local time and resolved at
 * query time through the IANA database, so they stay correct across DST. A
 * hardcoded "London = 07:00 UTC" is wrong for half the year (§9.1).
 */
export interface SessionDef {
  name: string
  timeZone: string
  openHour: number
  closeHour: number
  /** The window in which the Asian range is defined (§9.1). */
  rangeWindow?: boolean
}

export const SESSIONS: SessionDef[] = [
  { name: 'Sydney', timeZone: 'Australia/Sydney', openHour: 8, closeHour: 17 },
  { name: 'Tokyo', timeZone: 'Asia/Tokyo', openHour: 9, closeHour: 18, rangeWindow: true },
  { name: 'London', timeZone: 'Europe/London', openHour: 8, closeHour: 17 },
  { name: 'New York', timeZone: 'America/New_York', openHour: 8, closeHour: 17 },
]

function localHour(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return (hour % 24) + minute / 60
}

function isWeekend(date: Date, timeZone: string): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date)
  return weekday === 'Sat' || weekday === 'Sun'
}

export function isOpen(session: SessionDef, date: Date = new Date()): boolean {
  if (isWeekend(date, session.timeZone)) return false
  const hour = localHour(date, session.timeZone)
  return session.openHour <= session.closeHour
    ? hour >= session.openHour && hour < session.closeHour
    : hour >= session.openHour || hour < session.closeHour
}

export function openSessions(date: Date = new Date()): SessionDef[] {
  return SESSIONS.filter((s) => isOpen(s, date))
}

/** Peak liquidity is the London/New York overlap (§9.1). */
export function isOverlap(date: Date = new Date()): boolean {
  const open = new Set(openSessions(date).map((s) => s.name))
  return open.has('London') && open.has('New York')
}

export function sessionLabel(date: Date = new Date()): string {
  const open = openSessions(date)
  if (open.length === 0) return 'Between sessions'
  if (isOverlap(date)) return 'London / New York overlap'
  return `${open.map((s) => s.name).join(' + ')} session`
}
