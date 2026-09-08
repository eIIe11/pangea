import { describe, expect, it } from 'vitest'
import { demoSnapshot } from './demo'
import { tradesCsv } from './api'

describe('demo feed', () => {
  it('is deterministic for a given seed', () => {
    const a = demoSnapshot(7)
    const b = demoSnapshot(7)
    expect(a.account.equityUsd).toBe(b.account.equityUsd)
    expect(a.strategies.map((s) => s.liveSharpe)).toEqual(b.strategies.map((s) => s.liveSharpe))
  })

  it('labels itself as demo everywhere it is consumed', () => {
    const snapshot = demoSnapshot()
    expect(snapshot.source).toBe('demo')
    expect(snapshot.account.source).toBe('demo')
    expect(snapshot.research.source).toBe('demo')
  })

  it('carries a timestamp on every payload', () => {
    const snapshot = demoSnapshot()
    for (const asOf of [snapshot.asOf, snapshot.account.asOf, snapshot.research.asOf]) {
      expect(Number.isNaN(Date.parse(asOf))).toBe(false)
    }
  })

  it('gives every open position a resting exchange-side stop', () => {
    for (const position of demoSnapshot().positions) {
      if (position.side !== 'flat') expect(position.restingStop).not.toBeNull()
    }
  })

  it('exports trades as CSV with the causing signal', () => {
    const snapshot = demoSnapshot()
    const csv = tradesCsv(snapshot.trades)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(snapshot.trades.length + 1)
    expect(lines[0]).toContain('reason')
    expect(csv).toContain('"')
  })
})
