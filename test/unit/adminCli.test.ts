import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { hashAppPassword, passwordProblem, runAdmin } from '../../scripts/admin'

describe('hashAppPassword', () => {
  it('verifies with the hasher nuxt-auth-utils builds (Scrypt with the module default {})', async () => {
    const hash = await hashAppPassword('correct horse')
    const appHasher = new Hash(new Scrypt({}))
    expect(hash.startsWith('$scrypt$')).toBe(true)
    expect(await appHasher.verify(hash, 'correct horse')).toBe(true)
    expect(await appHasher.verify(hash, 'wrong horse')).toBe(false)
  })
})

describe('passwordProblem', () => {
  it('needs 8+ characters and a matching repeat', () => {
    expect(passwordProblem('short', 'short')).toBe('Password must be at least 8 characters')
    expect(passwordProblem('password1', 'password2')).toBe('Passwords do not match')
    expect(passwordProblem('password1', 'password1')).toBeNull()
  })
})

describe('runAdmin', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('exits 1 when DATABASE_URL is empty', async () => {
    vi.stubEnv('DATABASE_URL', '')
    expect(await runAdmin(['set-admin', 'a@example.com'])).toBe(1)
  })

  it('prints usage and exits 2 on a bad command', async () => {
    expect(await runAdmin([])).toBe(2)
    expect(await runAdmin(['promote', 'a@example.com'])).toBe(2)
    expect(await runAdmin(['set-admin'])).toBe(2)
  })
})
