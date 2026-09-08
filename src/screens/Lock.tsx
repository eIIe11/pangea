import { useEffect, useState } from 'react'
import { Coin } from '../components/Coin'
import { IS_DEMO } from '../lib/api'

/**
 * Device gate, not authentication: the passcode ships in the bundle, so it only stops
 * someone picking up an unlocked phone. The engine authenticates every request itself,
 * and nothing typed here can widen a risk limit.
 */
const PASSCODE = import.meta.env.VITE_LOCK_PASSCODE ?? '091285'
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const

export function Lock({ onUnlock }: { onUnlock: (user: string) => void }) {
  const [entry, setEntry] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (entry.length < PASSCODE.length) return
    if (entry === PASSCODE) {
      onUnlock('elle')
      return
    }
    setError(true)
    const timer = setTimeout(() => {
      setEntry('')
      setError(false)
    }, 600)
    return () => clearTimeout(timer)
  }, [entry, onUnlock])

  function press(key: string) {
    if (key === '⌫') {
      setEntry((current) => current.slice(0, -1))
      return
    }
    setError(false)
    setEntry((current) => (current.length >= PASSCODE.length ? current : current + key))
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 items-center justify-center px-6 pt-10">
        <Coin size={160} />
      </div>

      <div className="space-y-5 rounded-t-[2.5rem] bg-pg-accent/90 px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-pg-bg">
        <div className="text-center leading-none">
          <div className="text-sm font-light tracking-[0.2em] text-pg-bg/80 uppercase">Powered by</div>
          <div className="text-4xl font-extrabold tracking-[0.12em] uppercase">Pangea</div>
        </div>

        <div
          className={`flex justify-center gap-3 ${error ? 'animate-shake' : ''}`}
          role="status"
          aria-label={`Passcode: ${entry.length} of ${PASSCODE.length} digits entered`}
        >
          {Array.from({ length: PASSCODE.length }, (_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full ${
                error ? 'bg-pg-down' : i < entry.length ? 'bg-pg-bg' : 'bg-pg-bg/25'
              }`}
            />
          ))}
        </div>

        <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
          {KEYS.map((key, i) =>
            key === '' ? (
              <span key={i} />
            ) : (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                aria-label={key === '⌫' ? 'Delete' : key}
                className={`rounded-2xl py-4 text-2xl font-light text-pg-bg active:bg-white/40 ${
                  key === '⌫' ? 'text-lg' : 'bg-white/25'
                }`}
              >
                {key}
              </button>
            ),
          )}
        </div>

        <p className="min-h-4 text-center text-[11px] text-pg-bg/80">
          {error
            ? 'Wrong passcode.'
            : IS_DEMO
              ? 'Demo mode — no engine configured behind this screen.'
              : 'Engine session required after unlock.'}
        </p>
      </div>
    </div>
  )
}
