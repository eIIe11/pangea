/**
 * WebAuthn's wire format is JSON with base64url fields; the browser API wants ArrayBuffers.
 * These conversions are the whole translation layer, kept pure so they can be tested without
 * an authenticator: a mistake here reads as "Face ID failed" and is otherwise invisible.
 */

export function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function bytesToBase64url(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface JsonDescriptor {
  id: string
  type: 'public-key'
  transports?: AuthenticatorTransport[]
}

function decodeDescriptors(list: JsonDescriptor[] | undefined): PublicKeyCredentialDescriptor[] {
  return (list ?? []).map((item) => ({
    ...item,
    id: base64urlToBytes(item.id) as unknown as BufferSource,
  }))
}

export function decodeCreationOptions(json: string): PublicKeyCredentialCreationOptions {
  const options = JSON.parse(json) as PublicKeyCredentialCreationOptions & {
    challenge: string
    user: { id: string; name: string; displayName: string }
    excludeCredentials?: JsonDescriptor[]
  }
  return {
    ...options,
    challenge: base64urlToBytes(options.challenge) as unknown as BufferSource,
    user: { ...options.user, id: base64urlToBytes(options.user.id) as unknown as BufferSource },
    excludeCredentials: decodeDescriptors(options.excludeCredentials),
  }
}

export function decodeRequestOptions(json: string): PublicKeyCredentialRequestOptions {
  const options = JSON.parse(json) as PublicKeyCredentialRequestOptions & {
    challenge: string
    allowCredentials?: JsonDescriptor[]
  }
  return {
    ...options,
    challenge: base64urlToBytes(options.challenge) as unknown as BufferSource,
    allowCredentials: decodeDescriptors(options.allowCredentials),
  }
}

/**
 * Only the fields the server verifies, encoded the way it expects. Sending the credential
 * object itself would serialise the ArrayBuffers to `{}` and every login would be rejected.
 */
export function credentialToJson(credential: PublicKeyCredential): Record<string, unknown> {
  const response = credential.response
  const base = {
    id: credential.id,
    rawId: bytesToBase64url(credential.rawId),
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
  }
  if ('attestationObject' in response) {
    const attestation = response as AuthenticatorAttestationResponse
    return {
      ...base,
      response: {
        clientDataJSON: bytesToBase64url(attestation.clientDataJSON),
        attestationObject: bytesToBase64url(attestation.attestationObject),
        transports: attestation.getTransports?.() ?? [],
      },
    }
  }
  const assertion = response as AuthenticatorAssertionResponse
  return {
    ...base,
    response: {
      clientDataJSON: bytesToBase64url(assertion.clientDataJSON),
      authenticatorData: bytesToBase64url(assertion.authenticatorData),
      signature: bytesToBase64url(assertion.signature),
      userHandle: assertion.userHandle ? bytesToBase64url(assertion.userHandle) : null,
    },
  }
}
