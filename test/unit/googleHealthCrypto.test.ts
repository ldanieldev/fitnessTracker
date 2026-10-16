import { describe, expect, it } from 'vitest'
import { decryptToken, encryptToken, isValidTokenKey } from '../../server/utils/googleHealth/crypto'
import { GOOGLE_HEALTH_SCOPES, SCOPE } from '../../server/utils/googleHealth/scopes'

const KEY = Buffer.alloc(32, 7).toString('base64')
const OTHER = Buffer.alloc(32, 9).toString('base64')

describe('token encryption', () => {
  it('round-trips and never stores the plaintext', () => {
    const enc = encryptToken('1//refresh-token', KEY)
    expect(enc.startsWith('v1:')).toBe(true)
    expect(enc).not.toContain('refresh-token')
    expect(decryptToken(enc, KEY)).toBe('1//refresh-token')
  })

  it('uses a fresh IV each time', () => {
    expect(encryptToken('same', KEY)).not.toBe(encryptToken('same', KEY))
  })

  it('fails with the wrong key or a tampered ciphertext', () => {
    const enc = encryptToken('secret', KEY)
    expect(() => decryptToken(enc, OTHER)).toThrow()
    const parts = enc.split(':')
    parts[3] = Buffer.from('tampered').toString('base64url')
    expect(() => decryptToken(parts.join(':'), KEY)).toThrow()
    expect(() => decryptToken('garbage', KEY)).toThrow('Unrecognized token format')
  })

  it('accepts only a 32-byte base64 key', () => {
    expect(isValidTokenKey(KEY)).toBe(true)
    expect(isValidTokenKey('')).toBe(false)
    expect(isValidTokenKey(Buffer.alloc(16).toString('base64'))).toBe(false)
  })
})

describe('scopes', () => {
  it('asks for sign-in identity, three reads and the metrics write', () => {
    expect(GOOGLE_HEALTH_SCOPES).toEqual([
      'openid',
      'email',
      SCOPE.metricsRead,
      SCOPE.sleepRead,
      SCOPE.activityRead,
      SCOPE.metricsWrite
    ])
    expect(SCOPE.metricsWrite).toBe(
      'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.writeonly'
    )
  })
})
