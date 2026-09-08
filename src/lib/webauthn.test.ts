import { describe, expect, it } from 'vitest'
import {
  base64urlToBytes,
  bytesToBase64url,
  credentialToJson,
  decodeCreationOptions,
  decodeRequestOptions,
} from './webauthn'

describe('base64url', () => {
  it('round-trips bytes that need padding and the URL alphabet', () => {
    const bytes = new Uint8Array([0, 1, 251, 252, 253, 254, 255, 62, 63])
    expect(base64urlToBytes(bytesToBase64url(bytes))).toEqual(bytes)
  })

  it('decodes unpadded input, which is all the server ever sends', () => {
    expect(Array.from(base64urlToBytes('AQID'))).toEqual([1, 2, 3])
    expect(Array.from(base64urlToBytes('AQI'))).toEqual([1, 2])
    expect(bytesToBase64url(new Uint8Array([1, 2]))).not.toContain('=')
  })
})

describe('option decoding', () => {
  it('turns the challenge, user id and credential ids into bytes', () => {
    const options = decodeCreationOptions(
      JSON.stringify({
        rp: { name: 'Pangea', id: 'localhost' },
        user: { id: 'ZWxsZQ', name: 'elle', displayName: 'Elle' },
        challenge: 'AQID',
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        excludeCredentials: [{ id: 'AQI', type: 'public-key' }],
      }),
    )
    expect(Array.from(options.challenge as Uint8Array)).toEqual([1, 2, 3])
    expect(new TextDecoder().decode(options.user.id as Uint8Array)).toBe('elle')
    expect(Array.from(options.excludeCredentials?.[0]?.id as Uint8Array)).toEqual([1, 2])
  })

  it('tolerates a login without allowCredentials rather than throwing', () => {
    const options = decodeRequestOptions(JSON.stringify({ challenge: 'AQID', rpId: 'localhost' }))
    expect(options.allowCredentials).toEqual([])
  })
})

describe('credentialToJson', () => {
  const shared = {
    id: 'abc',
    rawId: new Uint8Array([1, 2]).buffer,
    type: 'public-key',
    getClientExtensionResults: () => ({}),
  }

  it('base64url-encodes an assertion, because JSON.stringify would flatten the buffers', () => {
    const json = credentialToJson({
      ...shared,
      authenticatorAttachment: 'platform',
      response: {
        clientDataJSON: new Uint8Array([1]).buffer,
        authenticatorData: new Uint8Array([2]).buffer,
        signature: new Uint8Array([3]).buffer,
        userHandle: null,
      },
    } as unknown as PublicKeyCredential)
    expect(json).toMatchObject({ rawId: 'AQI', authenticatorAttachment: 'platform' })
    expect(json.response).toEqual({
      clientDataJSON: 'AQ',
      authenticatorData: 'Ag',
      signature: 'Aw',
      userHandle: null,
    })
  })

  it('sends the attestation shape for a registration', () => {
    const json = credentialToJson({
      ...shared,
      response: {
        clientDataJSON: new Uint8Array([1]).buffer,
        attestationObject: new Uint8Array([2]).buffer,
        getTransports: () => ['internal'],
      },
    } as unknown as PublicKeyCredential)
    expect(json.response).toEqual({
      clientDataJSON: 'AQ',
      attestationObject: 'Ag',
      transports: ['internal'],
    })
  })
})
