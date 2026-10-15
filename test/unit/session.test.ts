import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { H3Event } from 'h3'
import { forbidToken, requireSessionUser, requireUserId } from '../../server/utils/session'
import { resolveToken, touchToken } from '../../server/utils/accessTokens/store'

vi.mock('../../server/utils/accessTokens/store', () => ({ resolveToken: vi.fn(), touchToken: vi.fn() }))

const createError = (opts: { statusCode: number; statusMessage: string }) =>
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
  vi.stubGlobal('getRequestHeader', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requireSessionUser', () => {
  it('throws 401 without querying the db when there is no session user', async () => {
    const dbMock = createDbMock([])
    vi.stubGlobal('createError', createError)
    vi.stubGlobal(
      'getUserSession',
      vi.fn(() => Promise.resolve({ user: undefined }))
    )
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
    vi.stubGlobal(
      'getUserSession',
      vi.fn(() => Promise.resolve({ user: sessionUser }))
    )
    vi.stubGlobal('clearUserSession', vi.fn())
    vi.stubGlobal('db', dbMock)

    const event = { context: {} } as unknown as H3Event

    const result = await requireSessionUser(event)
    expect(result).toEqual(sessionUser)
    expect(event.context.sessionUserExists).toBe(true)
    expect(event.context.authVia).toBe('session')
    expect(dbMock.select).toHaveBeenCalledTimes(1)

    await requireSessionUser(event)
    expect(dbMock.select).toHaveBeenCalledTimes(1)
  })

  it('clears the session and throws 401 when the user row is gone (stale cookie after a DB reset)', async () => {
    const sessionUser = { id: 1, email: 'me@example.com' }
    const dbMock = createDbMock([])
    const clearUserSession = vi.fn(() => Promise.resolve())
    vi.stubGlobal('createError', createError)
    vi.stubGlobal(
      'getUserSession',
      vi.fn(() => Promise.resolve({ user: sessionUser }))
    )
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
    vi.stubGlobal(
      'getUserSession',
      vi.fn(() => Promise.resolve({ user: sessionUser }))
    )
    vi.stubGlobal('clearUserSession', vi.fn())
    vi.stubGlobal('db', dbMock)

    const event = { context: {} } as unknown as H3Event

    await expect(requireUserId(event)).resolves.toBe(42)
  })
})

describe('requireSessionUser with an Authorization header', () => {
  const token = 'mfj_' + 'a'.repeat(43)
  const user = { id: 7, email: 't@example.com' }

  function event() {
    return { context: {} } as unknown as H3Event
  }

  it('resolves a valid token to its owner, marks the request, and never reads the cookie', async () => {
    vi.stubGlobal('createError', createError)
    vi.stubGlobal(
      'getRequestHeader',
      vi.fn(() => `Bearer ${token}`)
    )
    const getUserSession = vi.fn()
    vi.stubGlobal('getUserSession', getUserSession)
    vi.mocked(resolveToken).mockResolvedValue({ tokenId: 3, user } as never)
    const e = event()
    await expect(requireSessionUser(e)).resolves.toEqual(user)
    expect(e.context).toMatchObject({ authVia: 'token', accessTokenId: 3 })
    expect(touchToken).toHaveBeenCalledWith(3)
    expect(getUserSession).not.toHaveBeenCalled()
  })

  it.each(['Basic abc', 'Bearer nope', ''])('401s on %j without falling back to the cookie', async (header) => {
    vi.stubGlobal('createError', createError)
    vi.stubGlobal(
      'getRequestHeader',
      vi.fn(() => header)
    )
    const getUserSession = vi.fn(() => Promise.resolve({ user }))
    vi.stubGlobal('getUserSession', getUserSession)
    await expect(requireSessionUser(event())).rejects.toMatchObject({ statusCode: 401 })
    expect(getUserSession).not.toHaveBeenCalled()
  })

  it('401s on an unknown token', async () => {
    vi.stubGlobal('createError', createError)
    vi.stubGlobal(
      'getRequestHeader',
      vi.fn(() => `Bearer ${token}`)
    )
    vi.mocked(resolveToken).mockResolvedValue(null)
    await expect(requireSessionUser(event())).rejects.toMatchObject({ statusCode: 401 })
  })

  it('forbidToken throws 403 for token requests only', () => {
    vi.stubGlobal('createError', createError)
    expect(() => forbidToken({ context: { authVia: 'token' } } as unknown as H3Event)).toThrow(
      expect.objectContaining({ statusCode: 403 })
    )
    expect(() => forbidToken({ context: { authVia: 'session' } } as unknown as H3Event)).not.toThrow()
  })

  it('forbidToken throws 403 on an authorization header before requireSessionUser has run', () => {
    vi.stubGlobal('createError', createError)
    vi.stubGlobal(
      'getRequestHeader',
      vi.fn((_e: unknown, name: string) => (name === 'authorization' ? `Bearer ${token}` : undefined))
    )
    expect(() => forbidToken(event())).toThrow(expect.objectContaining({ statusCode: 403 }))
  })
})
