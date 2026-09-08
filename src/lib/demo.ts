import type { Account, EquityPoint, Position, ResearchReport, Snapshot, Strategy, Trade } from './types'

/**
 * Deterministic stand-in for the FastAPI service, used until VITE_API_BASE points at
 * a real engine. Everything it returns is tagged `source: 'demo'` and the UI labels
 * it as such — the one thing this app must never do is show an invented number as real.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAY_MS = 86_400_000

function equityCurve(rand: () => number, days: number, start: number): EquityPoint[] {
  const points: EquityPoint[] = []
  let equity = start
  let benchmark = start
  const now = Date.now()
  for (let i = days; i >= 0; i--) {
    const shock = (rand() - 0.47) * 0.012
    equity *= 1 + shock * 0.8 + 0.0007
    benchmark *= 1 + (rand() - 0.5) * 0.016 + 0.0003
    points.push({
      t: new Date(now - i * DAY_MS).toISOString(),
      equity: Math.round(equity),
      benchmark: Math.round(benchmark),
    })
  }
  return points
}

const STRATEGIES: Omit<Strategy, 'liveSharpe' | 'health' | 'overrides90d' | 'decay'>[] = [
  {
    id: 'tsmom',
    name: 'Time-series momentum',
    stage: 'capped',
    enabled: true,
    allocation: 0.46,
    backtestSharpe: 0.58,
    gates: { dsr: 1.12, pbo: 0.14, tStat: 3.41 },
  },
  {
    id: 'carry',
    name: 'Futures carry',
    stage: 'shadow',
    enabled: true,
    allocation: 0.18,
    backtestSharpe: 0.44,
    gates: { dsr: 0.71, pbo: 0.28, tStat: 3.05 },
  },
  {
    id: 'session-break',
    name: 'Asia range → London break',
    stage: 'shadow',
    enabled: true,
    allocation: 0.12,
    backtestSharpe: 0.39,
    gates: { dsr: 0.22, pbo: 0.41, tStat: 3.02 },
  },
  {
    id: 'statarb-mes-mnq',
    name: 'Stat-arb MES / MNQ',
    stage: 'auto',
    enabled: true,
    allocation: 0.24,
    backtestSharpe: 0.51,
    gates: { dsr: 0.94, pbo: 0.19, tStat: 3.18 },
  },
]

export function demoSnapshot(seed = 7): Snapshot {
  const rand = mulberry32(seed)
  const asOf = new Date().toISOString()
  const curve = equityCurve(rand, 90, 41_800)
  const last = curve[curve.length - 1]
  const equityUsd = last ? last.equity : 42_000
  const fxRate = 0.652

  const account: Account = {
    asOf,
    source: 'demo',
    referenceCurrency: 'AUD',
    equityUsd,
    equityRef: Math.round(equityUsd / fxRate),
    fxRate,
    returns: { day: 0.0121, week: 0.0338, month: 0.0814, inception: 0.1972 },
    returnsRef: { day: 0.0104, month: 0.0731, inception: 0.1615 },
    riskUsed: 0.34,
    costOfGross: 0.22,
    engine: 'running',
    drawdown: { fromPeak: 0.062, percentile: 58, medianRecoveryWeeks: [3, 5], breakerAt: 0.15 },
    fxExposure: { hedgeInstrument: 'M6A', notionalUsd: equityUsd, hedged: true },
    stopCoverage: { covered: 2, total: 2 },
    equityCurve: curve,
  }

  const positions: Position[] = [
    { symbol: 'MES', side: 'long', contracts: 2, pnlUsd: 412, health: 'ok', restingStop: 5_842.25, strategyId: 'tsmom' },
    { symbol: 'M6E', side: 'short', contracts: 3, pnlUsd: 88, health: 'ok', restingStop: 1.0994, strategyId: 'carry' },
    { symbol: 'MGC', side: 'flat', contracts: 0, pnlUsd: 0, health: 'ok', restingStop: null, strategyId: 'tsmom' },
  ]

  const strategies: Strategy[] = STRATEGIES.map((s, i) => {
    const liveSharpe = Number((s.backtestSharpe * (0.62 + rand() * 0.6)).toFixed(2))
    const divergence = Math.abs(liveSharpe - s.backtestSharpe) / s.backtestSharpe
    return {
      ...s,
      liveSharpe,
      health: divergence > 0.45 ? 'warn' : 'ok',
      overrides90d: {
        count: [4, 1, 7, 0][i] ?? 0,
        pnlVsSystemUsd: [-318, -44, -1_102, 0][i] ?? 0,
        hitRate: [0.25, 0.0, 0.29, 0][i] ?? 0,
      },
      decay: {
        icTrend: Number(((rand() - 0.55) * 0.02).toFixed(4)),
        slippageDrift: Number((rand() * 0.6).toFixed(2)),
        deallocated: false,
      },
    }
  })

  const reasons: [string, string][] = [
    ['MES', 'Ensemble momentum long (1/3/6/12m agree). Vol regime normal, size scaled to 12% target vol. Risk 0.5%. Stop 1.8× ATR.'],
    ['M6E', 'Carry short — EUR curve in contango against USD. No scheduled release within 90 min. Risk 0.4%. Stop 1.4× ATR.'],
    ['MNQ', 'Asian range high swept on London open, close-back-inside failed. Risk 0.35%. Stop at range midpoint.'],
    ['MGC', 'Momentum exit — 3m lookback flipped sign. Flatten at next available price.'],
    ['MES', 'Stat-arb entry: MES/MNQ spread z = +2.1, OU half-life 4.2 days, cointegration holding. Risk 0.5%.'],
  ]

  const trades: Trade[] = Array.from({ length: 24 }, (_, i) => {
    const pick = reasons[i % reasons.length]
    const symbol = pick ? pick[0] : 'MES'
    const reason = pick ? pick[1] : ''
    const modelSlippageBps = 0.8
    return {
      id: `T-${(10_480 - i).toString()}`,
      t: new Date(Date.now() - i * 5.3 * 3_600_000).toISOString(),
      symbol,
      side: i % 3 === 0 ? 'short' : 'long',
      contracts: 1 + (i % 3),
      fillPrice: Number((symbol === 'M6E' ? 1.09 + rand() * 0.01 : 5_800 + rand() * 90).toFixed(symbol === 'M6E' ? 4 : 2)),
      slippageBps: Number((modelSlippageBps * (0.4 + rand() * 1.3)).toFixed(2)),
      modelSlippageBps,
      strategyId: strategies[i % strategies.length]?.id ?? 'tsmom',
      manual: i === 3 || i === 14,
      reason,
    }
  })

  const research: ResearchReport = {
    asOf,
    source: 'demo',
    cpcv: {
      paths: Array.from({ length: 36 }, () => Number((0.15 + rand() * 1.25 - (rand() < 0.18 ? 0.75 : 0)).toFixed(2))),
      trainFolds: 10,
      testFolds: 8,
      embargoDays: 21,
    },
    gates: { dsr: 1.12, pbo: 0.14, tStat: 3.41, minBacktestLengthYears: 3.4, sampleYears: 5.2 },
    costMultiples: [
      { multiple: 1, netSharpe: 0.58 },
      { multiple: 2, netSharpe: 0.41 },
      { multiple: 3, netSharpe: 0.22 },
    ],
    plateau: {
      parameter: 'lookback (months)',
      points: [
        { value: 1, sharpe: 0.21 },
        { value: 2, sharpe: 0.34 },
        { value: 3, sharpe: 0.49 },
        { value: 6, sharpe: 0.57 },
        { value: 9, sharpe: 0.58 },
        { value: 12, sharpe: 0.55 },
        { value: 18, sharpe: 0.36 },
      ],
      selected: 9,
    },
    regimes: [
      { name: 'Bull', sharpe: 0.74, maxDrawdown: 0.048 },
      { name: 'Bear', sharpe: 0.61, maxDrawdown: 0.071 },
      { name: 'Chop', sharpe: -0.08, maxDrawdown: 0.093 },
      { name: 'High vol', sharpe: 0.82, maxDrawdown: 0.104 },
      { name: 'Low vol', sharpe: 0.19, maxDrawdown: 0.032 },
    ],
    agentCycles: [
      { cycle: 41, hypothesis: 'Session-conditional vol-scaled breakout on M6E', survived: true, costUsd: 6.4, note: 'Uncorrelated (ρ 0.11) to library. Promoted to shadow.' },
      { cycle: 40, hypothesis: 'Order-flow imbalance standalone entry, MNQ', survived: false, costUsd: 8.1, note: 'Edge vanished when downsampled to the 250ms live feed (§13.6).' },
      { cycle: 39, hypothesis: 'Turn-of-month tilt across all four instruments', survived: false, costUsd: 5.2, note: 'Net of costs t = 1.7. Below the 3.0 gate.' },
      { cycle: 38, hypothesis: 'Carry + momentum interaction term, MGC', survived: false, costUsd: 7.7, note: 'ρ 0.83 with existing carry factor. Correlation Red Sea.' },
    ],
    trialCount: 1_284,
  }

  return { asOf, source: 'demo', account, positions, strategies, trades, research }
}
