import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { H3Event } from 'h3'
import { forbidToken, requireSessionUser, requireUserId, validSessionUserId } from '../../server/utils/session'
import { resolveToken, touchToken } from '../../server/utils/accessTokens/store'
import { assertUnderLimit, recordFailure } from '../../server/utils/rateLimit/limit'

vi.mock('../../server/utils/accessTokens/store', () => ({ resolveToken: vi.fn(), touchToken: vi.fn() }))
vi.mock('../../server/utils/rateLimit/limit', () => ({
  RATE_RULES: { badToken: {} },
  assertUnderLimit: vi.fn(),
  clientIp: vi.fn(() => '127.0.0.1'),
  recordFailure: vi.fn()
}))

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
    const dbMock = createDbMock([{ isActive: true, sessionEpoch: 0, isAdmin: false }])
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
    expect(event.context.sessionUserValid).toBe(true)
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

  it.each([
    ['a stale epoch', { isActive: true, sessionEpoch: 1, isAdmin: false }],
    ['a disabled user', { isActive: false, sessionEpoch: 0, isAdmin: false }]
  ])('clears the session and throws 401 for %s', async (_name, row) => {
    const dbMock = createDbMock([row])
    const clearUserSession = vi.fn(() => Promise.resolve())
    vi.stubGlobal('createError', createError)
    vi.stubGlobal(
      'getUserSession',
      vi.fn(() => Promise.resolve({ user: { id: 1, email: 'me@example.com' } }))
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
    const dbMock = createDbMock([{ isActive: true, sessionEpoch: 0, isAdmin: false }])
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

describe('validSessionUserId', () => {
  function stub(session: unknown, rows: unknown[]) {
    const dbMock = createDbMock(rows)
    const clearUserSession = vi.fn(() => Promise.resolve())
    vi.stubGlobal(
      'getUserSession',
      vi.fn(() => Promise.resolve(session))
    )
    vi.stubGlobal('clearUserSession', clearUserSession)
    vi.stubGlobal('db', dbMock)
    return { dbMock, clearUserSession }
  }

  const event = () => ({ context: {} }) as unknown as H3Event

  it('returns the id when the row matches the cookie epoch and is active', async () => {
    const { clearUserSession } = stub({ user: { id: 5 }, secure: { epoch: 2 } }, [{ isActive: true, sessionEpoch: 2 }])
    await expect(validSessionUserId(event())).resolves.toBe(5)
    expect(clearUserSession).not.toHaveBeenCalled()
  })

  it.each([
    ['a stale epoch', [{ isActive: true, sessionEpoch: 3 }]],
    ['a disabled user', [{ isActive: false, sessionEpoch: 2 }]],
    ['a missing row', []]
  ])('clears the cookie and returns undefined for %s', async (_name, rows) => {
    const { clearUserSession } = stub({ user: { id: 5 }, secure: { epoch: 2 } }, rows)
    const e = event()
    await expect(validSessionUserId(e)).resolves.toBeUndefined()
    expect(clearUserSession).toHaveBeenCalledWith(e)
  })

  it('returns undefined without querying the db when there is no session user', async () => {
    const { dbMock } = stub({}, [])
    await expect(validSessionUserId(event())).resolves.toBeUndefined()
    expect(dbMock.select).not.toHaveBeenCalled()
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
    expect(recordFailure).toHaveBeenCalledTimes(1)
  })

  it('checks the bad-token limit before resolving and counts no failure for a valid token', async () => {
    vi.stubGlobal(
      'getRequestHeader',
      vi.fn(() => `Bearer ${token}`)
    )
    vi.mocked(assertUnderLimit).mockRejectedValueOnce(Object.assign(new Error('Too many'), { statusCode: 429 }))
    await expect(requireSessionUser(event())).rejects.toMatchObject({ statusCode: 429 })
    expect(resolveToken).not.toHaveBeenCalled()

    vi.mocked(resolveToken).mockResolvedValue({ tokenId: 3, user: { id: 1 } } as never)
    await requireSessionUser(event())
    expect(recordFailure).not.toHaveBeenCalled()
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
