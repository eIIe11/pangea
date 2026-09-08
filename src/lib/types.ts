export type Health = 'ok' | 'warn' | 'breach'
export type Stage = 'shadow' | 'capped' | 'auto'
export type EngineState = 'running' | 'entries_paused' | 'halted'
export type Side = 'long' | 'short' | 'flat'
export type FeedSource = 'live' | 'demo'
export type Currency = 'AUD' | 'USD' | 'THB'

/** Every payload carries the instant it was true. The UI never renders a number without one. */
export interface Stamped {
  asOf: string
  source: FeedSource
}

export interface EquityPoint {
  t: string
  equity: number
  benchmark: number
}

export interface Account extends Stamped {
  referenceCurrency: Currency
  equityUsd: number
  equityRef: number
  fxRate: number
  /** Fractions, not percents: 0.012 is +1.2%. */
  returns: { day: number; week: number; month: number; inception: number }
  returnsRef: { day: number; month: number; inception: number }
  riskUsed: number
  costOfGross: number
  engine: EngineState
  drawdown: {
    fromPeak: number
    percentile: number
    medianRecoveryWeeks: [number, number]
    breakerAt: number
  }
  fxExposure: { hedgeInstrument: string; notionalUsd: number; hedged: boolean }
  stopCoverage: { covered: number; total: number }
  equityCurve: EquityPoint[]
}

export interface Position {
  symbol: string
  side: Side
  contracts: number
  pnlUsd: number
  health: Health
  restingStop: number | null
  strategyId: string
}

export interface Strategy {
  id: string
  name: string
  stage: Stage
  enabled: boolean
  allocation: number
  liveSharpe: number
  backtestSharpe: number
  health: Health
  gates: { dsr: number; pbo: number; tStat: number }
  overrides90d: { count: number; pnlVsSystemUsd: number; hitRate: number }
  decay: { icTrend: number; slippageDrift: number; deallocated: boolean }
}

export interface Trade {
  id: string
  t: string
  symbol: string
  side: Exclude<Side, 'flat'>
  contracts: number
  fillPrice: number
  slippageBps: number
  modelSlippageBps: number
  strategyId: string
  manual: boolean
  /** Plain-language cause, per §17 signal explanation. */
  reason: string
}

export interface ResearchReport extends Stamped {
  cpcv: { paths: number[]; trainFolds: number; testFolds: number; embargoDays: number }
  gates: { dsr: number; pbo: number; tStat: number; minBacktestLengthYears: number; sampleYears: number }
  costMultiples: { multiple: number; netSharpe: number }[]
  plateau: { parameter: string; points: { value: number; sharpe: number }[]; selected: number }
  regimes: { name: string; sharpe: number; maxDrawdown: number }[]
  agentCycles: { cycle: number; hypothesis: string; survived: boolean; costUsd: number; note: string }[]
  trialCount: number
}

export interface Snapshot extends Stamped {
  account: Account
  positions: Position[]
  strategies: Strategy[]
  trades: Trade[]
  research: ResearchReport
}

export type ControlAction = 'halve' | 'pause_entries' | 'stop_everything' | 'resume'
