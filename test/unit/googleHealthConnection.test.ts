import { describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/db', () => ({ db: {} }))

const grant = { googleSub: 'sub-b', googleEmail: 'b@example.com', refreshTokenEnc: 'enc', scopes: ['openid'] }

describe('connectValues', () => {
  it('turns both opt-ins off when a different Google account replaces the connection', async () => {
    const { connectValues } = await import('../../server/utils/googleHealth/connection')
    expect(connectValues({ googleSub: 'sub-a' }, grant)).toEqual({
      ...grant,
      status: 'active',
      lastError: null,
      syncSteps: false,
      pushWeight: false
    })
  })

  it('keeps the opt-ins on a same-account reconnect and on a first connect', async () => {
    const { connectValues } = await import('../../server/utils/googleHealth/connection')
    for (const previous of [{ googleSub: 'sub-b' }, null]) {
      const values = connectValues(previous, grant)
      expect(values).not.toHaveProperty('syncSteps')
      expect(values).not.toHaveProperty('pushWeight')
    }
  })

  it('never clears a running sync claim', async () => {
    const { connectValues } = await import('../../server/utils/googleHealth/connection')
    expect(connectValues({ googleSub: 'sub-a' }, grant)).not.toHaveProperty('syncStartedAt')
    expect(connectValues(null, grant)).not.toHaveProperty('syncStartedAt')
  })
})

describe('syncCooldownSeconds', () => {
  const now = Date.parse('2026-10-16T12:00:00Z')
  const ago = (s: number) => new Date(now - s * 1000)

  it('is 0 for a connection that never synced, or synced over a minute ago', async () => {
    const { syncCooldownSeconds } = await import('../../server/utils/googleHealth/connection')
    expect(syncCooldownSeconds({ lastSyncedAt: null, syncStartedAt: null }, now, 60)).toBe(0)
    expect(syncCooldownSeconds({ lastSyncedAt: ago(61), syncStartedAt: null }, now, 60)).toBe(0)
  })

  it('counts from the later of the last finish and the last start', async () => {
    const { syncCooldownSeconds } = await import('../../server/utils/googleHealth/connection')
    expect(syncCooldownSeconds({ lastSyncedAt: ago(10), syncStartedAt: null }, now, 60)).toBe(50)
    expect(syncCooldownSeconds({ lastSyncedAt: ago(300), syncStartedAt: ago(5) }, now, 60)).toBe(55)
  })

  it('is always 0 with the cooldown off', async () => {
    const { syncCooldownSeconds } = await import('../../server/utils/googleHealth/connection')
    expect(syncCooldownSeconds({ lastSyncedAt: ago(0), syncStartedAt: ago(0) }, now, 0)).toBe(0)
  })
})
