import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { H3Event } from 'h3'
import { requireSessionUser, requireUserId } from '../../server/utils/session'

const createError = (opts: { statusCode: number, statusMessage: string }) =>
  Object.assign(new Error(opts.statusMessage), opts)

function createDbMock(rows: unknown[]) {
  const limit = vi.fn(() => Promise.resolve(rows))
  const where = vi.fn(() => ({ limit }))
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  return { select, from, where, limit }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requireSessionUser', () => {
  it('throws 401 without querying the db when there is no session user', async () => {
    const dbMock = createDbMock([])
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getUserSession', vi.fn(() => Promise.resolve({ user: undefined })))
    vi.stubGlobal('clearUserSession', vi.fn())
    vi.stubGlobal('db', dbMock)

    const event = { context: {} } as unknown as H3Event

    await expect(requireSessionUser(event)).rejects.toMatchObject({ statusCode: 401 })
    expect(dbMock.select).not.toHaveBeenCalled()
  })

  it('returns the session user when the row still exists, caching the check on event.context', async () => {
    const sessionUser = { id: 1, email: 'me@example.com' }
    const dbMock = createDbMock([{ id: 1 }])
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getUserSession', vi.fn(() => Promise.resolve({ user: sessionUser })))
    vi.stubGlobal('clearUserSession', vi.fn())
    vi.stubGlobal('db', dbMock)

    const event = { context: {} } as unknown as H3Event

    const result = await requireSessionUser(event)
    expect(result).toEqual(sessionUser)
    expect(event.context.sessionUserExists).toBe(true)
    expect(dbMock.select).toHaveBeenCalledTimes(1)

    // Second call on the same event re-uses the cached existence check.
    await requireSessionUser(event)
    expect(dbMock.select).toHaveBeenCalledTimes(1)
  })

  it('clears the session and throws 401 when the user row is gone (stale cookie after a DB reset)', async () => {
    const sessionUser = { id: 1, email: 'me@example.com' }
    const dbMock = createDbMock([])
    const clearUserSession = vi.fn(() => Promise.resolve())
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getUserSession', vi.fn(() => Promise.resolve({ user: sessionUser })))
    vi.stubGlobal('clearUserSession', clearUserSession)
    vi.stubGlobal('db', dbMock)

    const event = { context: {} } as unknown as H3Event

    await expect(requireSessionUser(event)).rejects.toMatchObject({ statusCode: 401 })
    expect(clearUserSession).toHaveBeenCalledWith(event)
  })
})

describe('requireUserId', () => {
  it('resolves the numeric id of a valid session user', async () => {
    const sessionUser = { id: 42, email: 'me@example.com' }
    const dbMock = createDbMock([{ id: 42 }])
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getUserSession', vi.fn(() => Promise.resolve({ user: sessionUser })))
    vi.stubGlobal('clearUserSession', vi.fn())
    vi.stubGlobal('db', dbMock)

    const event = { context: {} } as unknown as H3Event

    await expect(requireUserId(event)).resolves.toBe(42)
  })
})
