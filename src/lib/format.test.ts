import { describe, expect, it } from 'vitest'
import { fmtAge, fmtOrdinal, fmtPct, fmtRatio, fmtSignedMoney, isStale, STALE_AFTER_MS } from './format'

describe('formatting', () => {
  it('signs percentages', () => {
    expect(fmtPct(0.0121)).toBe('+1.2%')
    expect(fmtPct(-0.0621)).toBe('−6.2%')
    expect(fmtPct(0)).toBe('0.0%')
  })

  it('signs money without currency drift', () => {
    expect(fmtSignedMoney(412)).toBe('+$412')
    expect(fmtSignedMoney(-1102)).toBe('−$1,102')
  })

  it('renders unsigned ratios for meters', () => {
    expect(fmtRatio(0.34)).toBe('34%')
  })

  it('renders ordinals for drawdown percentiles', () => {
    expect(fmtOrdinal(58)).toBe('58th')
    expect(fmtOrdinal(1)).toBe('1st')
    expect(fmtOrdinal(22)).toBe('22nd')
    expect(fmtOrdinal(13)).toBe('13th')
  })
})

describe('staleness', () => {
  const now = Date.parse('2026-09-08T06:00:00.000Z')

  it('ages timestamps in words', () => {
    expect(fmtAge(new Date(now - 2_000).toISOString(), now)).toBe('just now')
    expect(fmtAge(new Date(now - 30_000).toISOString(), now)).toBe('30s ago')
    expect(fmtAge(new Date(now - 600_000).toISOString(), now)).toBe('10m ago')
    expect(fmtAge(new Date(now - 3 * 86_400_000).toISOString(), now)).toBe('3d ago')
  })

  it('flags anything past the stale window', () => {
    expect(isStale(new Date(now - STALE_AFTER_MS + 1_000).toISOString(), now)).toBe(false)
    expect(isStale(new Date(now - STALE_AFTER_MS - 1_000).toISOString(), now)).toBe(true)
  })
})
