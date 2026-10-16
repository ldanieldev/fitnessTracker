import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  refreshAccessToken: vi.fn(async () => 'access'),
  deleteWeights: vi.fn(async () => undefined),
  listWeightsAt: vi.fn(async () => []),
  createWeight: vi.fn(async () => 'users/me/dataTypes/weight/dataPoints/new')
}))
const state = vi.hoisted(() => ({ connection: null as unknown, rows: [] as unknown[] }))

vi.mock('../../server/utils/googleHealth/api', () => ({ ...api, GoogleAuthError: class extends Error {} }))
vi.mock('../../server/utils/googleHealth/config', () => ({
  googleHealthConfig: () => ({ available: true, tokenKey: 'key', clientId: 'client' })
}))
vi.mock('../../server/utils/googleHealth/crypto', () => ({ decryptToken: () => 'refresh' }))
vi.mock('../../server/utils/googleHealth/connection', () => ({
  loadActiveConnection: async () => state.connection,
  loadConnection: async () => state.connection,
  markReconnect: vi.fn(),
  granted: () => ({ weightWrite: true })
}))
vi.mock('../../server/utils/inngest/client', () => ({ inngest: { send: vi.fn() } }))
vi.mock('../../server/utils/logger', () => ({ logger: { warn: vi.fn() } }))

function chain(result: () => unknown[]) {
  const c = {
    from: () => c,
    where: () => c,
    set: () => c,
    then: <A>(onfulfilled: (value: unknown[]) => A) => Promise.resolve(result()).then(onfulfilled)
  }
  return c
}

vi.mock('../../server/utils/db', () => ({
  db: { select: () => chain(() => state.rows), update: () => chain(() => []) }
}))

const activeConnection = { userId: 7, pushWeight: true, status: 'active', scopes: [], refreshTokenEnc: 'enc' }
const row = (externalId: string | null) => ({
  id: 5,
  userId: 7,
  value: '200',
  measuredOn: '2026-10-15',
  measuredAt: new Date('2026-10-15T12:00:00Z'),
  externalId
})
const change = (previousExternalId: string | null, deleted = false) => ({
  userId: 7,
  measurementId: 5,
  utcOffsetMinutes: -300,
  previousExternalId,
  deleted
})

beforeEach(() => {
  vi.clearAllMocks()
  state.connection = activeConnection
  state.rows = []
})

describe('pushWeight', () => {
  it('skips a disabled user (no active connection) before touching Google', async () => {
    const { pushWeight } = await import('../../server/utils/googleHealth/weightPush')
    state.connection = null
    expect(await pushWeight(change('users/me/dataTypes/weight/dataPoints/a'))).toBe('skipped')
    expect(api.refreshAccessToken).not.toHaveBeenCalled()
  })

  it('deletes the live row\'s stored point, never the name the event carries', async () => {
    const { pushWeight } = await import('../../server/utils/googleHealth/weightPush')
    state.rows = [row('users/me/dataTypes/weight/dataPoints/ours')]
    expect(await pushWeight(change('users/me/dataTypes/weight/dataPoints/victim'))).toBe('pushed')
    expect(api.deleteWeights).toHaveBeenCalledWith('access', ['users/me/dataTypes/weight/dataPoints/ours'])
  })

  it('deletes nothing when the live row has no stored point, whatever the event names', async () => {
    const { pushWeight } = await import('../../server/utils/googleHealth/weightPush')
    state.rows = [row(null)]
    expect(await pushWeight(change('users/me/dataTypes/weight/dataPoints/victim'))).toBe('pushed')
    expect(api.deleteWeights).not.toHaveBeenCalled()
  })

  it('deletes the event\'s point for a deleted row, which has nothing stored to check against', async () => {
    const { pushWeight } = await import('../../server/utils/googleHealth/weightPush')
    expect(await pushWeight(change('users/me/dataTypes/weight/dataPoints/gone', true))).toBe('deleted')
    expect(api.deleteWeights).toHaveBeenCalledWith('access', ['users/me/dataTypes/weight/dataPoints/gone'])
  })
})
