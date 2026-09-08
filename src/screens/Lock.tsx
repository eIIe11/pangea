import { useState } from 'react'
import { Coin } from '../components/Coin'
import { IS_DEMO } from '../lib/api'

/**
 * Local device gate. It protects the screen, not the engine — the engine authenticates
 * every request itself, and no credential typed here can widen a risk limit.
 */
export function Lock({ onUnlock }: { onUnlock: (user: string) => void }) {
  const [user, setUser] = useState('elle')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (user.trim() === '' || secret.trim() === '') {
      setError('Both fields are required.')
      return
    }
    onUnlock(user.trim())
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pt-16">
        <Coin size={180} />
      </div>

      <form
        onSubmit={submit}
        className="space-y-3 rounded-t-[2.5rem] bg-pg-accent/90 px-6 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-pg-bg"
      >
        <div className="text-center leading-none">
          <div className="text-lg font-light tracking-[0.2em] text-pg-bg/80 uppercase">Powered by</div>
          <div className="text-4xl font-extrabold tracking-[0.12em] uppercase">Pangea</div>
        </div>

        <input
          value={user}
          onChange={(event) => setUser(event.target.value)}
          autoComplete="username"
          placeholder="User name"
          aria-label="User name"
          className="w-full rounded-md bg-white px-3 py-3 text-sm text-pg-bg outline-none"
        />
        <input
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="Passcode"
          aria-label="Passcode"
          className="w-full rounded-md bg-white px-3 py-3 text-sm text-pg-bg outline-none"
        />
        <button type="submit" className="w-full rounded-md bg-white py-3 text-sm font-bold tracking-[0.2em] text-pg-accent uppercase">
          Log in
        </button>

        <p className="min-h-4 text-center text-[11px] text-pg-bg/80">
          {error || (IS_DEMO ? 'Demo mode — no engine configured, any passcode opens the shell.' : 'Engine session required.')}
        </p>
      </form>
    </div>
  )
}
