import { describe, expect, it } from 'vitest'
import { SESSIONS, isOpen, isOverlap, openSessions, sessionLabel } from './sessions'

const london = SESSIONS.find((s) => s.name === 'London')!
const newYork = SESSIONS.find((s) => s.name === 'New York')!

describe('session boundaries follow DST, not fixed UTC offsets', () => {
  it('opens London at 07:00 UTC in summer (BST)', () => {
    expect(isOpen(london, new Date('2026-07-01T06:30:00Z'))).toBe(false)
    expect(isOpen(london, new Date('2026-07-01T07:30:00Z'))).toBe(true)
  })

  it('opens London at 08:00 UTC in winter (GMT)', () => {
    expect(isOpen(london, new Date('2026-01-05T07:30:00Z'))).toBe(false)
    expect(isOpen(london, new Date('2026-01-05T08:30:00Z'))).toBe(true)
  })

  it('shifts New York with US DST', () => {
    expect(isOpen(newYork, new Date('2026-07-01T12:30:00Z'))).toBe(true)
    expect(isOpen(newYork, new Date('2026-01-05T12:30:00Z'))).toBe(false)
    expect(isOpen(newYork, new Date('2026-01-05T13:30:00Z'))).toBe(true)
  })

  it('closes every session at the weekend', () => {
    expect(openSessions(new Date('2026-07-04T12:00:00Z'))).toHaveLength(0)
    expect(sessionLabel(new Date('2026-07-04T12:00:00Z'))).toBe('Between sessions')
  })

  it('names the peak-liquidity overlap', () => {
    const overlap = new Date('2026-07-01T13:00:00Z')
    expect(isOverlap(overlap)).toBe(true)
    expect(sessionLabel(overlap)).toBe('London / New York overlap')
  })
})
