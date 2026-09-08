import { useEffect, useState } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

const DISMISS_KEY = 'pangea.install.dismissed'

/** Adds the app to the phone home screen or the desktop dock. Hidden once installed. */
export function InstallHint() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const standalone = window.matchMedia('(display-mode: standalone)').matches
  if (standalone || dismissed || !event) return null

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-pg-line px-3 py-2 text-xs text-pg-mute">
      <span>Install Pangea for one-tap access to the kill switch.</span>
      <span className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            void event.prompt()
            setEvent(null)
          }}
          className="rounded-lg border border-pg-accent px-3 py-1.5 text-pg-text uppercase"
        >
          Install
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1')
            setDismissed(true)
          }}
          aria-label="Dismiss install prompt"
        >
          ✕
        </button>
      </span>
    </div>
  )
}
