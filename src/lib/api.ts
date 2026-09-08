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
 * Resolves to NO_BODY when the engine answers 2xx with nothing: an accepted kill switch that
 * returns 204 must never surface to the operator as a failure. Distinct from a JSON `null`,
 * which is a body the engine chose to send and cannot be read as a result.
 */
export const NO_BODY = Symbol('no body')

async function request<T>(path: string, init?: RequestInit): Promise<T | typeof NO_BODY> {
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
    return body === '' ? NO_BODY : (JSON.parse(body) as T)
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
  if (snapshot === NO_BODY) throw new ApiError('/api/snapshot returned no data')
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

/**
 * An empty 2xx means accepted; anything else has to say so explicitly. Defaulting a missing
 * `accepted` to true would report an unconfirmed order as routed.
 */
function asControlResult(path: string, body: unknown): ControlResult {
  if (body === NO_BODY) return { accepted: true }
  if (typeof body !== 'object' || body === null || !('accepted' in body))
    throw new ApiError(`${path} returned an unreadable result`)
  const { accepted, reason } = body as { accepted: unknown; reason?: unknown }
  if (typeof accepted !== 'boolean') throw new ApiError(`${path} returned an unreadable result`)
  return { accepted, ...(typeof reason === 'string' ? { reason } : {}) }
}

export async function sendControl(action: ControlAction): Promise<ControlResult> {
  if (IS_DEMO) {
    return { accepted: false, reason: 'Demo mode — no engine connected, nothing was sent.' }
  }
  const result = await request<unknown>('/api/control', {
    method: 'POST',
    body: JSON.stringify({ action }),
  })
  return asControlResult('/api/control', result)
}

export interface ManualOrder {
  symbol: string
  side: 'long' | 'short'
  riskPct: 0.25 | 0.5 | 0.75 | 1
  stop: 'tight' | 'normal' | 'wide'
}

export async function submitManualOrder(order: ManualOrder): Promise<ControlResult> {
  if (IS_DEMO) return { accepted: false, reason: 'Demo mode — no engine connected, nothing was routed.' }
  const result = await request<unknown>('/api/orders/manual', {
    method: 'POST',
    body: JSON.stringify(order),
  })
  return asControlResult('/api/orders/manual', result)
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
