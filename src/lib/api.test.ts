import { afterEach, describe, expect, it, vi } from 'vitest'

/** Loads api.ts against a configured engine, since demo mode short-circuits every request. */
async function liveApi() {
  vi.stubEnv('VITE_API_BASE', 'https://engine.test')
  vi.resetModules()
  return await import('./api')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('control transport', () => {
  it('treats a 204 with no body as accepted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    )
    const { sendControl } = await liveApi()
    await expect(sendControl('stop_everything')).resolves.toEqual({ accepted: true })
  })

  it('surfaces an engine refusal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ accepted: false, reason: 'breaker already tripped' })),
    )
    const { sendControl } = await liveApi()
    await expect(sendControl('halve')).resolves.toEqual({
      accepted: false,
      reason: 'breaker already tripped',
    })
  })

  it.each([['{}'], ['null'], ['7'], ['"ok"'], ['{"accepted":"yes"}']])(
    'refuses to read %s as a result',
    async (body) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(body, { status: 200 })),
      )
      const { sendControl } = await liveApi()
      await expect(sendControl('halve')).rejects.toThrow('unreadable result')
    },
  )

  it('fails loudly on a non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    )
    const { sendControl } = await liveApi()
    await expect(sendControl('halve')).rejects.toThrow('/api/control failed')
  })

  it('never routes a demo order', async () => {
    vi.stubEnv('VITE_API_BASE', '')
    vi.resetModules()
    const { submitManualOrder } = await import('./api')
    const result = await submitManualOrder({ symbol: 'MES', side: 'long', riskPct: 0.5, stop: 'normal' })
    expect(result.accepted).toBe(false)
    expect(result.reason).toContain('nothing was routed')
  })
})

describe('manual order transport', () => {
  it('never reports an unconfirmed order as routed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true })),
    )
    const { submitManualOrder } = await liveApi()
    await expect(
      submitManualOrder({ symbol: 'MES', side: 'long', riskPct: 0.5, stop: 'normal' }),
    ).rejects.toThrow('unreadable result')
  })
})

describe('snapshot transport', () => {
  it('refuses to invent a snapshot from an empty body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 200 })),
    )
    const { getSnapshot } = await liveApi()
    await expect(getSnapshot()).rejects.toThrow('no data')
  })
})
