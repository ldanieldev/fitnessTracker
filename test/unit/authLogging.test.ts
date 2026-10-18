import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Error, H3Event } from 'h3'
import pino from 'pino'
import { z } from 'zod'
import { logOAuthFlowError, withoutErrorData } from '../../server/utils/auth'
import { logger } from '../../server/utils/logger'
import { requireAdmin, requireSessionUser } from '../../server/utils/session'
import { resolveToken } from '../../server/utils/accessTokens/store'
import { issuePaths } from '../../server/utils/validation'
import { parseWith } from '../../server/utils/nutrition/parseBody'

vi.mock('../../server/utils/insertUser', () => ({ insertUser: vi.fn() }))
vi.mock('../../server/utils/registration', () => ({ registrationOpen: vi.fn(), assertRegistrationOpenIn: vi.fn() }))
vi.mock('../../server/utils/accessTokens/store', () => ({ resolveToken: vi.fn(), touchToken: vi.fn() }))
vi.mock('../../server/utils/rateLimit/limit', () => ({
  RATE_RULES: { badToken: {} },
  clientIp: vi.fn(() => '127.0.0.1'),
  consumeLimit: vi.fn()
}))

const createError = (opts: { statusCode: number; statusMessage: string }) =>
  Object.assign(new Error(opts.statusMessage), opts)

const spies = () => ({
  debug: vi.spyOn(logger, 'debug').mockImplementation(() => {}),
  info: vi.spyOn(logger, 'info').mockImplementation(() => {}),
  warn: vi.spyOn(logger, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(logger, 'error').mockImplementation(() => {})
})

beforeEach(() => {
  vi.stubGlobal('createError', createError)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function oauthError(data: Record<string, unknown>) {
  return Object.assign(new Error('GitHub login failed'), { statusCode: 401, data }) as unknown as H3Error
}

describe('logOAuthFlowError', () => {
  it('logs a declined consent at info without an err, so Sentry opens no issue', () => {
    const log = spies()
    logOAuthFlowError('github', oauthError({ error: 'access_denied', state: 's3cret-state' }))
    expect(log.error).not.toHaveBeenCalled()
    expect(log.info).toHaveBeenCalledWith(
      { event: 'auth.oauth_declined', provider: 'github', providerError: 'access_denied' },
      expect.any(String)
    )
  })

  it('logs a real failure at error with the provider response stripped from err', () => {
    const log = spies()
    logOAuthFlowError('google', oauthError({ error: 'invalid_grant', code: 'oauth-code', access_token: 'tok' }))
    expect(log.error).toHaveBeenCalledOnce()
    const [fields] = log.error.mock.calls[0] as unknown as [{ err: Error; providerError: string }]
    expect(fields.providerError).toBe('invalid_grant')
    const serialised = JSON.stringify(pino.stdSerializers.err(fields.err))
    expect(serialised).toContain('GitHub login failed')
    expect(serialised).not.toMatch(/oauth-code|tok"|access_token/)
  })

  it('passes an error without data through untouched', () => {
    const err = new Error('db down')
    expect(withoutErrorData(err)).toBe(err)
  })
})

describe('session rejection logs', () => {
  const sessionUser = { id: 4, email: 'me@example.com' }

  function stubSession(row: unknown) {
    const limit = vi.fn(() => Promise.resolve(row ? [row] : []))
    vi.stubGlobal('db', { select: () => ({ from: () => ({ where: () => ({ limit }) }) }) })
    vi.stubGlobal('getRequestHeader', vi.fn())
    vi.stubGlobal('getUserSession', vi.fn(() => Promise.resolve({ user: sessionUser, secure: { epoch: 0 } })))
    vi.stubGlobal('clearUserSession', vi.fn())
  }

  it('says why a session cookie was rejected, by id only', async () => {
    const log = spies()
    stubSession({ isActive: false, sessionEpoch: 0, isAdmin: false })
    await expect(requireSessionUser({ path: '/api/x', context: {} } as unknown as H3Event)).rejects.toMatchObject({
      statusCode: 401
    })
    expect(log.info).toHaveBeenCalledWith(
      { event: 'auth.session_rejected', userId: 4, reason: 'disabled' },
      expect.any(String)
    )
  })

  it('warns when a non-admin reaches an admin route', async () => {
    const log = spies()
    stubSession({ isActive: true, sessionEpoch: 0, isAdmin: false })
    const event = { path: '/api/admin/users', context: {} } as unknown as H3Event
    await expect(requireAdmin(event)).rejects.toMatchObject({ statusCode: 403 })
    expect(log.warn).toHaveBeenCalledWith(
      { event: 'auth.admin_required', userId: 4, route: '/api/admin/users' },
      expect.any(String)
    )
  })

  it('warns on an unknown bearer token without logging the token', async () => {
    const log = spies()
    vi.stubGlobal('getRequestHeader', vi.fn(() => 'Bearer mfj_' + 'z'.repeat(43)))
    vi.mocked(resolveToken).mockResolvedValue(null)
    await expect(requireSessionUser({ path: '/api/x', context: {} } as unknown as H3Event)).rejects.toMatchObject({
      statusCode: 401
    })
    expect(log.warn).toHaveBeenCalledWith(
      { event: 'auth.bad_token', route: '/api/x', malformed: false },
      expect.any(String)
    )
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain('zzz')
  })
})

describe('validation logs', () => {
  it('masks record keys that are not identifier-shaped', () => {
    const schema = z.object({
      mapping: z.record(z.string(), z.number()),
      sets: z.array(z.object({ reps: z.number() }))
    })
    const parsed = schema.safeParse({ mapping: { 'Bench Press': 'x', squat: 'y' }, sets: [{ reps: 'a' }] })
    expect(parsed.success).toBe(false)
    expect(issuePaths(parsed.error!).sort()).toEqual(['mapping.*', 'mapping.squat', 'sets.0.reps'])
  })

  it('logs failing paths at debug but never the values', () => {
    const log = spies()
    expect(() => parseWith(z.object({ note: z.number() }), { note: 'my secret note' })).toThrow()
    expect(log.debug).toHaveBeenCalledWith({ paths: ['note'] }, expect.any(String))
    expect(JSON.stringify(log.debug.mock.calls)).not.toContain('secret')
  })
})

describe('csrf middleware log', () => {
  it('warns with the reason and the two hosts only', async () => {
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useRuntimeConfig', () => ({ trustProxy: 'false' }))
    const headers: Record<string, string> = { origin: 'https://evil.example:8443/path?q=1', host: 'app.test' }
    vi.stubGlobal('getRequestHeader', (_e: unknown, name: string) => headers[name])
    const { default: csrf } = await import('../../server/middleware/01.csrf')
    const log = spies()
    const event = { method: 'POST', path: '/api/foods?x=1', context: {}, node: { req: { headers } } }
    expect(() => (csrf as unknown as (e: unknown) => void)(event)).toThrow(expect.objectContaining({ statusCode: 403 }))
    expect(log.warn).toHaveBeenCalledWith(
      {
        reason: 'Origin does not match Host',
        method: 'POST',
        route: '/api/foods',
        secFetchSite: undefined,
        originHost: 'evil.example:8443',
        host: 'app.test'
      },
      expect.any(String)
    )
  })
})
