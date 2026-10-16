import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { findOrCreateUserAndLinkProvider } from '../../server/utils/auth'
import { insertUser } from '../../server/utils/insertUser'
import { registrationOpen } from '../../server/utils/registration'

vi.mock('../../server/utils/insertUser', () => ({ insertUser: vi.fn() }))
vi.mock('../../server/utils/registration', () => ({ registrationOpen: vi.fn(async () => true) }))

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
  const db: Record<string, unknown> = { select, insert, update }
  db.transaction = (fn: (tx: unknown) => unknown) => fn(db)
  return { db, select, insert, insertValues, update, updateSet }
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
  vi.mocked(registrationOpen).mockReset().mockResolvedValue(true)
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
      mock.db,
      expect.objectContaining({ email: 'new@gmail.com', name: 'New User', avatarUrl: 'pic' })
    )
    expect(mock.insert).toHaveBeenCalledTimes(1)
    expect(mock.insertValues).toHaveBeenCalledWith({
      userId: 42,
      provider: 'google',
      providerAccountId: 'g-123'
    })
  })

  it('refuses (403) to create a user while registration is closed', async () => {
    vi.mocked(registrationOpen).mockResolvedValueOnce(false)
    const mock = createDbMock([[], []])
    stubDb(mock)

    const attempt = findOrCreateUserAndLinkProvider({ email: 'new@gmail.com', name: 'New' }, provider)
    await expect(attempt).rejects.toMatchObject({ statusCode: 403 })
    expect(insertUser).not.toHaveBeenCalled()
    expect(mock.insert).not.toHaveBeenCalled()
  })

  it('still signs an existing user in while registration is closed', async () => {
    vi.mocked(registrationOpen).mockResolvedValue(false)
    const existing = { id: 7, email: 'me@example.com', name: 'Me', avatarUrl: 'x' }
    stubDb(createDbMock([[], [existing]]))

    await expect(findOrCreateUserAndLinkProvider({ email: 'me@example.com', name: 'Me' }, provider)).resolves.toEqual(
      existing
    )
  })

  it('creates the user with a lower-cased email', async () => {
    vi.mocked(insertUser).mockResolvedValue({ id: 43, email: 'mixed@gmail.com' } as never)
    stubDb(createDbMock([[], []]))

    await findOrCreateUserAndLinkProvider({ email: ' Mixed@Gmail.com', name: 'Mixed' }, provider)

    expect(insertUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ email: 'mixed@gmail.com' }))
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
