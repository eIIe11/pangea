import { describe, expect, it } from 'vitest'
import { resolvePasscode } from './passcode'

describe('passcode configuration', () => {
  it('defaults when nothing is configured', () => {
    expect(resolvePasscode(undefined)).toEqual({ passcode: '091285', misconfigured: false })
    expect(resolvePasscode('')).toEqual({ passcode: '091285', misconfigured: false })
  })

  it('accepts 4-10 digits', () => {
    expect(resolvePasscode('1234')).toEqual({ passcode: '1234', misconfigured: false })
    expect(resolvePasscode('0912851234')).toEqual({ passcode: '0912851234', misconfigured: false })
  })

  it('falls back on anything a keypad cannot enter', () => {
    for (const bad of ['abc123', '12 34', '123', '12345678901', '09128-5', '091285\n']) {
      expect(resolvePasscode(bad)).toEqual({ passcode: '091285', misconfigured: true })
    }
  })
})
