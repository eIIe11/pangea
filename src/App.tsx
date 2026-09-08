import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Coin } from './components/Coin'
import { InstallHint } from './components/InstallHint'
import { Stamp } from './components/ui'
import { ApiError, IS_DEMO, getSnapshot } from './lib/api'
import { logout } from './lib/auth'
import { Lock } from './screens/Lock'
import { SignIn } from './screens/SignIn'
import { Now } from './screens/Now'
import { Research } from './screens/Research'
import { Strategies } from './screens/Strategies'
import { Trades } from './screens/Trades'

const SCREENS = ['now', 'strategies', 'trades', 'research'] as const
type Screen = (typeof SCREENS)[number]

const UNLOCK_KEY = 'pangea.user'

function initialScreen(): Screen {
  const requested = new URLSearchParams(window.location.search).get('screen')
  return SCREENS.includes(requested as Screen) ? (requested as Screen) : 'now'
}

export function App() {
  // Only demo mode may resume from storage: with an engine, the httpOnly session decides, so
  // remembering a name here would send an expired session straight past sign-in and strand it
  // on the error screen. SignIn re-reads /api/auth/status and walks straight in when the
  // cookie is still good.
  const [user, setUser] = useState<string | null>(() =>
    IS_DEMO ? localStorage.getItem(UNLOCK_KEY) : null,
  )
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const queries = useQueryClient()

  const snapshot = useQuery({
    queryKey: ['snapshot'],
    queryFn: getSnapshot,
    enabled: user !== null,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!IS_DEMO) return
    if (user) localStorage.setItem(UNLOCK_KEY, user)
    else localStorage.removeItem(UNLOCK_KEY)
  }, [user])

  const error = snapshot.error
  const expired = error instanceof ApiError && (error.status === 401 || error.status === 403)

  useEffect(() => {
    // A refused session is a locked app, not an error to stare at.
    if (!expired) return
    setUser(null)
    queries.removeQueries({ queryKey: ['snapshot'] })
  }, [expired, queries])

  function lock() {
    setUser(null)
    queries.removeQueries({ queryKey: ['snapshot'] })
  }

  if (user === null) return IS_DEMO ? <Lock onUnlock={setUser} /> : <SignIn onSignedIn={setUser} />

  if (snapshot.isError) {
    return (
      <div className="grid min-h-full place-items-center px-6 text-center">
        <div className="space-y-3">
          <Coin size={80} spin={false} />
          <p className="text-sm text-pg-down">
            {error instanceof ApiError && error.status === 503
              ? 'No account state yet.'
              : 'Engine unreachable.'}
          </p>
          {/* The engine's own words: "no IBKR gateway configured" is the answer, not a detail. */}
          <p className="text-xs text-pg-mute">{error instanceof Error ? error.message : null}</p>
          <p className="text-xs text-pg-mute">
            No numbers are shown rather than stale ones. The CLI and webhook kill switches do not depend on this app.
          </p>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={() => snapshot.refetch()} className="rounded-lg border border-pg-line px-4 py-2 text-xs uppercase">
              Retry
            </button>
            <button
              type="button"
              onClick={() => {
                if (IS_DEMO) return lock()
                void logout().finally(lock)
              }}
              className="rounded-lg border border-pg-line px-4 py-2 text-xs uppercase"
            >
              Lock
            </button>
          </div>
        </div>
      </div>
    )
  }

  const data = snapshot.data

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-pg-line bg-pg-bg/95 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <span className="flex items-center gap-2">
          <Coin size={22} />
          <span className="text-xs font-semibold tracking-[0.22em] uppercase">Pangea</span>
        </span>
        <span className="flex items-center gap-3">
          {data ? <Stamp asOf={data.asOf} source={data.source} /> : <span className="text-[11px] text-pg-mute">loading…</span>}
          {IS_DEMO ? null : (
            <button
              type="button"
              onClick={() => {
                void logout().finally(lock)
              }}
              className="text-[11px] tracking-[0.14em] text-pg-mute uppercase"
            >
              Lock
            </button>
          )}
        </span>
      </header>

      <main className="flex-1 px-4 py-4">
        {!data ? (
          <div className="grid place-items-center py-24">
            <Coin size={72} />
          </div>
        ) : screen === 'now' ? (
          <Now account={data.account} positions={data.positions} />
        ) : screen === 'strategies' ? (
          <Strategies strategies={data.strategies} />
        ) : screen === 'trades' ? (
          <Trades trades={data.trades} />
        ) : (
          <Research research={data.research} />
        )}
        <InstallHint />
      </main>

      <nav className="sticky bottom-0 grid grid-cols-4 border-t border-pg-line bg-pg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {SCREENS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setScreen(option)}
            aria-current={screen === option}
            className={`py-3 text-[11px] tracking-[0.14em] uppercase ${screen === option ? 'text-pg-accent' : 'text-pg-mute'}`}
          >
            {option}
          </button>
        ))}
      </nav>
    </div>
  )
}
