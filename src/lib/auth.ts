import { API_BASE, ApiError } from './api'
import { credentialToJson, decodeCreationOptions, decodeRequestOptions } from './webauthn'

export interface AuthStatus {
  enrolled: boolean
  enrollmentOpen: boolean
  authenticated: boolean
  user: string | null
  awaitingTotp: boolean
  totpEnrolled: boolean
}

export const PASSKEY_SUPPORTED =
  typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function'

const TIMEOUT_MS = 8_000

/** The server answers auth routes with a JSON object or an error it wants shown verbatim. */
async function call<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    })
    const text = (await response.text()).trim()
    const payload = text === '' ? {} : (JSON.parse(text) as Record<string, unknown>)
    if (!response.ok) {
      const detail = payload.detail
      throw new ApiError(typeof detail === 'string' ? detail : `${path} failed`, response.status)
    }
    return payload as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(error instanceof Error ? error.message : 'network error')
  } finally {
    clearTimeout(timer)
  }
}

export function getAuthStatus(): Promise<AuthStatus> {
  return call<AuthStatus>('/api/auth/status')
}

/** Ceremony errors are the user cancelling Face ID far more often than a real fault. */
function ceremonyError(error: unknown): ApiError {
  if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError'))
    return new ApiError('Cancelled — the device prompt was dismissed.')
  return new ApiError(error instanceof Error ? error.message : 'the device refused the prompt')
}

async function ceremony(
  options: CredentialCreationOptions | CredentialRequestOptions,
  create: boolean,
): Promise<PublicKeyCredential> {
  let credential: Credential | null
  try {
    credential = create
      ? await navigator.credentials.create(options as CredentialCreationOptions)
      : await navigator.credentials.get(options as CredentialRequestOptions)
  } catch (error) {
    throw ceremonyError(error)
  }
  if (credential === null) throw new ApiError('No passkey was returned by this device.')
  return credential as PublicKeyCredential
}

export async function enrollPasskey(
  userId: string,
  displayName: string,
  enrollCode: string,
): Promise<void> {
  const { options } = await call<{ options: string }>('/api/auth/passkey/enroll/options', {
    user_id: userId,
    display_name: displayName,
    enroll_code: enrollCode,
  })
  const credential = await ceremony({ publicKey: decodeCreationOptions(options) }, true)
  await call('/api/auth/passkey/enroll/verify', {
    user_id: userId,
    credential: credentialToJson(credential),
  })
}

export interface PasskeyLogin {
  authenticated: boolean
  totpRequired: boolean
  user?: string
}

export async function loginWithPasskey(userId: string): Promise<PasskeyLogin> {
  const { options } = await call<{ options: string }>('/api/auth/passkey/login/options', {
    user_id: userId,
  })
  const credential = await ceremony({ publicKey: decodeRequestOptions(options) }, false)
  return call<PasskeyLogin>('/api/auth/passkey/login/verify', {
    user_id: userId,
    credential: credentialToJson(credential),
  })
}

export interface TotpEnrolment {
  otpauthUri: string
  qrPngBase64: string
}

export function startTotpEnrolment(): Promise<TotpEnrolment> {
  return call<TotpEnrolment>('/api/auth/totp/enroll', {})
}

export function confirmTotpEnrolment(code: string): Promise<{ verified: boolean }> {
  return call('/api/auth/totp/enroll/verify', { code })
}

export function totpLogin(code: string): Promise<{ authenticated: boolean; user: string }> {
  return call('/api/auth/totp/login', { code })
}

export function logout(): Promise<unknown> {
  return call('/api/auth/logout', {})
}
