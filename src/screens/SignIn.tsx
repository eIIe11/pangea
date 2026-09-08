import { useEffect, useState } from 'react'
import { Coin } from '../components/Coin'
import {
  PASSKEY_SUPPORTED,
  confirmTotpEnrolment,
  enrollPasskey,
  getAuthStatus,
  loginWithPasskey,
  startTotpEnrolment,
  totpLogin,
  type TotpEnrolment,
} from '../lib/auth'

const USER_ID = 'elle'

type Step = 'loading' | 'unreachable' | 'enrol' | 'passkey' | 'totp' | 'totp-setup'

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'that did not work'
}

/**
 * Real sign-in: the passkey is verified by the engine against a stored public key, and the
 * session lives in an httpOnly cookie this code cannot read. Nothing here decides whether
 * the user is in — the server does, and every screen behind it re-authenticates per request.
 */
export function SignIn({ onSignedIn }: { onSignedIn: (user: string) => void }) {
  const [step, setStep] = useState<Step>('loading')
  const [enrolmentOpen, setEnrolmentOpen] = useState(false)
  const [enrolCode, setEnrolCode] = useState('')
  const [code, setCode] = useState('')
  const [totp, setTotp] = useState<TotpEnrolment | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAuthStatus()
      .then((status) => {
        setEnrolmentOpen(status.enrollmentOpen)
        if (status.authenticated && status.user) return onSignedIn(status.user)
        if (status.awaitingTotp) return setStep('totp')
        setStep(status.enrolled ? 'passkey' : 'enrol')
      })
      .catch((problem) => {
        setError(message(problem))
        setStep('unreachable')
      })
  }, [onSignedIn])

  async function run(work: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (problem) {
      setError(message(problem))
    } finally {
      setBusy(false)
    }
  }

  const signIn = () =>
    run(async () => {
      const result = await loginWithPasskey(USER_ID)
      if (result.totpRequired) {
        setCode('')
        setStep('totp')
        return
      }
      onSignedIn(result.user ?? USER_ID)
    })

  const enrol = () =>
    run(async () => {
      await enrollPasskey(USER_ID, 'Elle', enrolCode)
      const result = await loginWithPasskey(USER_ID)
      if (!result.authenticated) throw new Error('enrolled, but the session was refused')
      setTotp(await startTotpEnrolment())
      setCode('')
      setStep('totp-setup')
    })

  const submitCode = () =>
    run(async () => {
      if (step === 'totp-setup') {
        await confirmTotpEnrolment(code)
        onSignedIn('Elle')
        return
      }
      const result = await totpLogin(code)
      onSignedIn(result.user)
    })

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 items-center justify-center px-6 pt-10">
        <Coin size={140} />
      </div>

      <div className="space-y-5 rounded-t-[2.5rem] bg-pg-accent/90 px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-pg-bg">
        <div className="text-center leading-none">
          <div className="text-sm font-light tracking-[0.2em] text-pg-bg/80 uppercase">Powered by</div>
          <div className="text-4xl font-extrabold tracking-[0.12em] uppercase">Pangea</div>
        </div>

        {step === 'loading' ? (
          <p className="text-center text-xs">Checking with the engine…</p>
        ) : step === 'unreachable' ? (
          <div className="space-y-2 text-center text-xs">
            <p>Engine unreachable — sign-in is server-side, so there is nothing to show yet.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-white/25 px-4 py-2 text-xs tracking-[0.14em] uppercase"
            >
              Retry
            </button>
          </div>
        ) : step === 'passkey' ? (
          <button
            type="button"
            onClick={signIn}
            disabled={busy || !PASSKEY_SUPPORTED}
            className="w-full rounded-2xl bg-white/25 py-4 text-sm font-semibold tracking-[0.14em] uppercase disabled:opacity-50"
          >
            {busy ? 'Waiting for the device…' : 'Unlock with Face ID'}
          </button>
        ) : step === 'enrol' ? (
          <div className="space-y-3">
            <p className="text-center text-xs">
              First device: enrol a passkey. The enrolment code is set on the engine, so a stranger
              who finds this URL cannot claim the account.
            </p>
            <input
              value={enrolCode}
              onChange={(event) => setEnrolCode(event.target.value)}
              type="password"
              autoComplete="one-time-code"
              placeholder="Enrolment code"
              aria-label="Enrolment code"
              className="w-full rounded-xl bg-white/25 px-4 py-3 text-center text-sm placeholder:text-pg-bg/60"
            />
            <button
              type="button"
              onClick={enrol}
              disabled={busy || enrolCode === '' || !enrolmentOpen || !PASSKEY_SUPPORTED}
              className="w-full rounded-2xl bg-white/25 py-4 text-sm font-semibold tracking-[0.14em] uppercase disabled:opacity-50"
            >
              {busy ? 'Waiting for the device…' : 'Enrol this device'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {step === 'totp-setup' && totp ? (
              <div className="space-y-2 text-center">
                <p className="text-xs">
                  Scan with Google Authenticator, then type the six digits to prove it took.
                </p>
                <img
                  src={`data:image/png;base64,${totp.qrPngBase64}`}
                  alt="Authenticator enrolment QR code"
                  className="mx-auto h-40 w-40 rounded-xl bg-white p-2"
                />
              </div>
            ) : (
              <p className="text-center text-xs">Authenticator code</p>
            )}
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              aria-label="Authenticator code"
              className="w-full rounded-xl bg-white/25 px-4 py-3 text-center text-lg tracking-[0.4em] placeholder:text-pg-bg/50"
            />
            <button
              type="button"
              onClick={submitCode}
              disabled={busy || code.length < 6}
              className="w-full rounded-2xl bg-white/25 py-4 text-sm font-semibold tracking-[0.14em] uppercase disabled:opacity-50"
            >
              {busy ? 'Checking…' : step === 'totp-setup' ? 'Confirm authenticator' : 'Sign in'}
            </button>
            {step === 'totp-setup' ? (
              <button
                type="button"
                onClick={() => onSignedIn('Elle')}
                className="w-full text-center text-[11px] underline"
              >
                Skip for now — passkey only
              </button>
            ) : null}
          </div>
        )}

        <p className="min-h-4 text-center text-[11px] text-pg-bg/80">
          {error
            ? error
            : !PASSKEY_SUPPORTED
              ? 'This browser has no passkey support — open the installed app or a current browser.'
              : 'Face ID, Touch ID or Windows Hello, verified by the engine.'}
        </p>
      </div>
    </div>
  )
}
