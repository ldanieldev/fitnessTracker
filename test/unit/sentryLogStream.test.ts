import { describe, expect, it, vi, beforeEach } from 'vitest'

const captureException = vi.fn()
const logger = { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() }
vi.mock('@sentry/nuxt', () => ({ logger, captureException }))

const { forwardLine, toSentryLevel } = await import('../../server/utils/sentryLogStream')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('toSentryLevel', () => {
  it('passes through pino level names', () => {
    expect(toSentryLevel('warn')).toBe('warn')
    expect(toSentryLevel('fatal')).toBe('fatal')
  })

  it('maps pino numeric levels', () => {
    expect(toSentryLevel(10)).toBe('trace')
    expect(toSentryLevel(50)).toBe('error')
  })

  it('falls back to info for anything unrecognised', () => {
    expect(toSentryLevel('silent')).toBe('info')
    expect(toSentryLevel(undefined)).toBe('info')
  })
})

describe('forwardLine', () => {
  it('forwards the message and keeps the remaining fields as attributes', () => {
    forwardLine(JSON.stringify({ level: 'info', time: 1, msg: 'user fetched', route: '/api/users/[id]', id: 7 }))

    expect(logger.info).toHaveBeenCalledWith('user fetched', { route: '/api/users/[id]', id: 7 })
  })

  it('drops level, time and msg from the attributes', () => {
    forwardLine(JSON.stringify({ level: 'warn', time: 1, msg: 'hm', keep: true }))

    expect(logger.warn).toHaveBeenCalledWith('hm', { keep: true })
  })

  it('also captures an exception when an error record is logged', () => {
    forwardLine(JSON.stringify({
      level: 'error',
      msg: 'GitHub OAuth flow failed',
      err: { type: 'TypeError', message: 'boom', stack: 'TypeError: boom\n    at x' },
      provider: 'github'
    }))

    expect(logger.error).toHaveBeenCalledWith('GitHub OAuth flow failed', { provider: 'github' })
    expect(captureException).toHaveBeenCalledOnce()
    const [error, hint] = captureException.mock.calls[0]!
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('TypeError')
    expect(error.message).toBe('boom')
    expect(hint).toEqual({ level: 'error', extra: { provider: 'github' } })
  })

  it('does not capture an exception for a plain error log with no err field', () => {
    forwardLine(JSON.stringify({ level: 'error', msg: 'no error object here' }))

    expect(logger.error).toHaveBeenCalledOnce()
    expect(captureException).not.toHaveBeenCalled()
  })

  it('does not capture an exception below error level', () => {
    forwardLine(JSON.stringify({ level: 'warn', msg: 'careful', err: { message: 'boom' } }))

    expect(captureException).not.toHaveBeenCalled()
  })

  it('ignores a line that is not JSON', () => {
    expect(() => forwardLine('not json')).not.toThrow()
    expect(logger.info).not.toHaveBeenCalled()
  })
})
