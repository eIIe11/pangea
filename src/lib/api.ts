import { demoSnapshot } from './demo'
import type { ControlAction, Snapshot } from './types'

export const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
export const IS_DEMO = API_BASE === ''

export class ApiError extends Error {
  status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const TIMEOUT_MS = 4_000

/**
 * Resolves to null when the engine answers 2xx with no body: an accepted kill switch that
 * returns 204 must never surface to the operator as a failure.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    })
    if (!response.ok) throw new ApiError(`${path} failed`, response.status)
    const body = (await response.text()).trim()
    return body === '' ? null : (JSON.parse(body) as T)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(error instanceof Error ? error.message : 'network error')
  } finally {
    clearTimeout(timer)
  }
}

export async function getSnapshot(): Promise<Snapshot> {
  if (IS_DEMO) return demoSnapshot()
  const snapshot = await request<Snapshot>('/api/snapshot')
  if (snapshot === null) throw new ApiError('/api/snapshot returned no data')
  return snapshot
}

/**
 * The three graduated controls (§17) plus resume. There is deliberately no endpoint
 * here for changing a risk limit: limits live in version-controlled config and need a
 * service restart, because a UI that can raise a limit is not a limit.
 */
export interface ControlResult {
  accepted: boolean
  reason?: string
}

export async function sendControl(action: ControlAction): Promise<ControlResult> {
  if (IS_DEMO) {
    return { accepted: false, reason: 'Demo mode — no engine connected, nothing was sent.' }
  }
  const result = await request<Partial<ControlResult>>('/api/control', {
    method: 'POST',
    body: JSON.stringify({ action }),
  })
  if (result === null) return { accepted: true }
  return { accepted: result.accepted ?? true, ...(result.reason === undefined ? {} : { reason: result.reason }) }
}

export interface ManualOrder {
  symbol: string
  side: 'long' | 'short'
  riskPct: 0.25 | 0.5 | 0.75 | 1
  stop: 'tight' | 'normal' | 'wide'
}

export async function submitManualOrder(order: ManualOrder): Promise<ControlResult> {
  if (IS_DEMO) return { accepted: false, reason: 'Demo mode — no engine connected, nothing was routed.' }
  const result = await request<Partial<ControlResult>>('/api/orders/manual', {
    method: 'POST',
    body: JSON.stringify(order),
  })
  if (result === null) return { accepted: true }
  return { accepted: result.accepted ?? true, ...(result.reason === undefined ? {} : { reason: result.reason }) }
}

export function tradesCsv(trades: Snapshot['trades']): string {
  const header = 'id,timestamp_utc,symbol,side,contracts,fill,slippage_bps,model_slippage_bps,strategy,manual,reason'
  const rows = trades.map((t) =>
    [
      t.id,
      t.t,
      t.symbol,
      t.side,
      t.contracts,
      t.fillPrice,
      t.slippageBps,
      t.modelSlippageBps,
      t.strategyId,
      t.manual ? 'yes' : 'no',
      `"${t.reason.replace(/"/g, '""')}"`,
    ].join(','),
  )
  return [header, ...rows].join('\n')
}
