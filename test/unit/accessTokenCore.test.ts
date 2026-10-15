import { describe, expect, it } from 'vitest'
import { generateToken, hashToken, parseBearer, TOKEN_PREFIX } from '../../server/utils/accessTokens/token'

describe('generateToken', () => {
  it('makes mfj_ + 43 base64url chars, its hash and an 8-char display prefix', () => {
    const { token, hash, prefix } = generateToken()
    expect(token).toMatch(/^mfj_[A-Za-z0-9_-]{43}$/)
    expect(hash).toBe(hashToken(token))
    expect(prefix).toBe(token.slice(TOKEN_PREFIX.length, TOKEN_PREFIX.length + 8))
  })

  it('never repeats', () => {
    expect(generateToken().token).not.toBe(generateToken().token)
  })
})

describe('hashToken', () => {
  it('is SHA-256 hex', () => {
    expect(hashToken('mfj_abc')).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken('mfj_abc')).toBe(hashToken('mfj_abc'))
    expect(hashToken('mfj_abc')).not.toBe(hashToken('mfj_abd'))
  })
})

describe('parseBearer', () => {
  const token = generateToken().token
  it.each([
    [`Bearer ${token}`, token],
    [`bearer ${token}`, token],
    [`  Bearer ${token}  `, token],
    ['', null],
    ['Bearer', null],
    ['Bearer ', null],
    [`Basic ${token}`, null],
    [token, null],
    ['Bearer mfj_short', null],
    [`Bearer ${token.replace('mfj_', 'xyz_')}`, null],
    [`Bearer ${token} extra`, null]
  ])('%j → %j', (header, expected) => {
    expect(parseBearer(header)).toBe(expected)
  })
})
