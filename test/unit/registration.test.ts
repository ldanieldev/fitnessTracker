import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertRegistrationOpenIn, registrationAllowed } from '../../server/utils/registration'

describe('registrationAllowed', () => {
  it('allows sign-ups while open', () => {
    expect(registrationAllowed('open', true)).toBe(true)
  })
  it('refuses sign-ups while closed once an account exists', () => {
    expect(registrationAllowed('closed', true)).toBe(false)
  })
  it('lets a fresh instance create its first account even while closed', () => {
    expect(registrationAllowed('closed', false)).toBe(true)
  })
  it('ignores case and padding', () => {
    expect(registrationAllowed(' Open', true)).toBe(true)
  })
  it('treats an unrecognised value as closed', () => {
    expect(registrationAllowed('opne', true)).toBe(false)
  })
})

describe('assertRegistrationOpenIn', () => {
  function fakeTx(userRows: unknown[]) {
    const calls: string[] = []
    const tx = {
      execute: vi.fn(async () => calls.push('lock')),
      select: () => ({
        from: () => ({
          limit: async () => {
            calls.push('select')
            return userRows
          }
        })
      })
    }
    return { tx: tx as never, calls }
  }
  const stubMode = (registration: string) => {
    vi.stubGlobal('useRuntimeConfig', () => ({ registration }))
    vi.stubGlobal('createError', (opts: { statusCode: number }) => Object.assign(new Error('closed'), opts))
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('takes the first-signup lock before counting users, and refuses once one exists', async () => {
    stubMode('closed')
    const { tx, calls } = fakeTx([{ id: 1 }])
    await expect(assertRegistrationOpenIn(tx)).rejects.toMatchObject({ statusCode: 403 })
    expect(calls).toEqual(['lock', 'select'])
  })

  it('lets the first signup through while closed', async () => {
    stubMode('closed')
    const { tx } = fakeTx([])
    await expect(assertRegistrationOpenIn(tx)).resolves.toBeUndefined()
  })

  it('skips the lock while open', async () => {
    stubMode('open')
    const { tx, calls } = fakeTx([{ id: 1 }])
    await expect(assertRegistrationOpenIn(tx)).resolves.toBeUndefined()
    expect(calls).toEqual([])
  })
})
