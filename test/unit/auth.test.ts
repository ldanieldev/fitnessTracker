import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { findOrCreateUserAndLinkProvider } from '../../server/utils/auth'
import { insertUser } from '../../server/utils/insertUser'

vi.mock('../../server/utils/insertUser', () => ({ insertUser: vi.fn() }))

function createDbMock(selectResults: unknown[][]) {
  const queue = [...selectResults]
  const insertValues = vi.fn(() => Promise.resolve())
  const insert = vi.fn(() => ({ values: insertValues }))
  const select = vi.fn(() => {
    const result = queue.shift() ?? []
    const chain: Record<string, unknown> = {
      from: () => chain,
      where: () => chain,
      limit: () => Promise.resolve(result)
    }
    return chain
  })
  const updateSet = vi.fn(() => ({ where: () => Promise.resolve() }))
  const update = vi.fn(() => ({ set: updateSet }))
  return { db: { select, insert, update }, select, insert, insertValues, update, updateSet }
}

const createError = (opts: { statusCode: number; statusMessage: string }) =>
  Object.assign(new Error(opts.statusMessage), opts)

const provider = { provider: 'google', providerAccountId: 'g-123' }

// stubGlobal, not a module mock, so unstubAllGlobals() restores the auto-imported db/createError after each test.
function stubDb(mock: ReturnType<typeof createDbMock>) {
  vi.stubGlobal('db', mock.db)
  vi.stubGlobal('createError', createError)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('findOrCreateUserAndLinkProvider — linking while signed in', () => {
  it('links a new provider to the CURRENT user, ignoring email (no account switch)', async () => {
    const currentUser = { id: 1, email: 'me@example.com', name: 'Me', avatarUrl: 'x' }
    const mock = createDbMock([
      [], // existing-link check → not linked
      [currentUser] // user-by-id lookup
    ])
    stubDb(mock)

    const result = await findOrCreateUserAndLinkProvider(
      { email: 'someone-else@gmail.com', name: 'GoogleName' },
      provider,
      1
    )

    expect(result).toEqual(currentUser)
    expect(mock.insertValues).toHaveBeenCalledWith({
      userId: 1,
      provider: 'google',
      providerAccountId: 'g-123'
    })
    // Only the link-check + by-id selects ran — the email resolution was skipped.
    expect(mock.select).toHaveBeenCalledTimes(2)
  })

  it('refuses (409) when the provider account is already linked to a different user', async () => {
    const mock = createDbMock([
      [{ userId: 99 }] // already linked to user 99
    ])
    stubDb(mock)

    await expect(
      findOrCreateUserAndLinkProvider({ email: 'me@example.com', name: 'Me' }, provider, 1)
    ).rejects.toMatchObject({ statusCode: 409 })

    expect(mock.insert).not.toHaveBeenCalled()
  })

  it('is idempotent when the provider is already linked to the current user', async () => {
    const currentUser = { id: 1, email: 'me@example.com', name: 'Me', avatarUrl: 'x' }
    const mock = createDbMock([
      [{ userId: 1 }], // already linked to the current user
      [currentUser] // returned user lookup
    ])
    stubDb(mock)

    const result = await findOrCreateUserAndLinkProvider({ email: 'me@example.com', name: 'Me' }, provider, 1)

    expect(result).toEqual(currentUser)
    expect(mock.insert).not.toHaveBeenCalled()
  })
})

describe('findOrCreateUserAndLinkProvider — login/signup (no session)', () => {
  it('resolves an existing user by email and links the provider', async () => {
    const existing = { id: 7, email: 'me@example.com', name: 'Me', avatarUrl: 'x' }
    const mock = createDbMock([
      [], // existing-link check → not linked
      [existing] // email lookup
    ])
    stubDb(mock)

    const result = await findOrCreateUserAndLinkProvider({ email: 'me@example.com', name: 'Me' }, provider)

    expect(result).toEqual(existing)
    expect(mock.insertValues).toHaveBeenCalledWith({
      userId: 7,
      provider: 'google',
      providerAccountId: 'g-123'
    })
  })

  it('creates a new user from the OAuth profile when no email match exists, then links the provider', async () => {
    const created = { id: 42, email: 'new@gmail.com', name: 'New User', avatarUrl: 'pic' }
    vi.mocked(insertUser).mockResolvedValue(created as never)
    const mock = createDbMock([
      [], // existing-link check → not linked
      [] // email lookup → no user found
    ])
    stubDb(mock)

    const result = await findOrCreateUserAndLinkProvider(
      { email: 'new@gmail.com', name: 'New User', avatarUrl: 'pic' },
      provider
    )

    expect(result).toEqual(created)
    expect(insertUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@gmail.com', name: 'New User', avatarUrl: 'pic' })
    )
    expect(mock.insert).toHaveBeenCalledTimes(1)
    expect(mock.insertValues).toHaveBeenCalledWith({
      userId: 42,
      provider: 'google',
      providerAccountId: 'g-123'
    })
  })

  it('backfills the avatar on an existing user that has none', async () => {
    const existing = { id: 7, email: 'me@example.com', name: 'Me', avatarUrl: null }
    const mock = createDbMock([
      [], // existing-link check → not linked
      [existing] // email lookup → user without avatar
    ])
    stubDb(mock)

    const result = await findOrCreateUserAndLinkProvider(
      { email: 'me@example.com', name: 'Me', avatarUrl: 'fresh-pic' },
      provider
    )

    expect(mock.update).toHaveBeenCalledTimes(1)
    expect(mock.updateSet).toHaveBeenCalledWith({ avatarUrl: 'fresh-pic' })
    expect(result.avatarUrl).toBe('fresh-pic')
    expect(insertUser).not.toHaveBeenCalled()
    expect(mock.insertValues).toHaveBeenCalledWith({
      userId: 7,
      provider: 'google',
      providerAccountId: 'g-123'
    })
  })
})
