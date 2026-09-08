const DEFAULT_PASSCODE = '091285'

/**
 * VITE_LOCK_PASSCODE must be 4-10 digits, because a keypad can only ever enter digits: a
 * configured letter would render a gate nobody can open. Malformed config falls back to the
 * default and says so, rather than bricking the app on someone's phone.
 */
export function resolvePasscode(configured: string | undefined): {
  passcode: string
  misconfigured: boolean
} {
  if (configured === undefined || configured === '') return { passcode: DEFAULT_PASSCODE, misconfigured: false }
  if (/^\d{4,10}$/.test(configured)) return { passcode: configured, misconfigured: false }
  return { passcode: DEFAULT_PASSCODE, misconfigured: true }
}
