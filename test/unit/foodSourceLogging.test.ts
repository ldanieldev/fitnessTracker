import { beforeEach, describe, expect, it, vi } from 'vitest'

const warn = vi.fn()
const error = vi.fn()
const debug = vi.fn()

vi.mock('../../server/utils/logger', () => {
  const log = {
    warn: (...a: unknown[]) => warn(...a),
    error: (...a: unknown[]) => error(...a),
    debug: (...a: unknown[]) => debug(...a)
  }
  return { logger: { ...log, child: () => log } }
})

const { withSourceLogging, resetExternalSourceLogThrottle } = await import(
  '../../server/utils/nutrition/external/registry'
)
const { ExternalSourceError } = await import('../../server/utils/nutrition/external/types')
type Source = Parameters<typeof withSourceLogging>[0]

function source(overrides: Partial<Source> = {}): Source {
  return {
    key: 'usda',
    search: vi.fn(async () => []),
    byBarcode: vi.fn(async () => null),
    byId: vi.fn(async () => null),
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  resetExternalSourceLogThrottle()
})

describe('withSourceLogging', () => {
  it('logs a success at debug with the result count and no query text', async () => {
    const wrapped = withSourceLogging(source({ search: vi.fn(async () => [{} as never, {} as never]) }))
    await wrapped.search('secret soup', 5)
    expect(debug).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'usda', op: 'search', results: 2, durationMs: expect.any(Number) }),
      expect.any(String)
    )
    expect(JSON.stringify(debug.mock.calls)).not.toContain('secret soup')
  })

  it('warns on a failure with its kind and status, then rethrows it', async () => {
    const failure = new ExternalSourceError('usda', 'unavailable', 'HTTP 502', { status: 502 })
    const wrapped = withSourceLogging(source({ byBarcode: vi.fn(async () => Promise.reject(failure)) }))
    await expect(wrapped.byBarcode('0123456789012')).rejects.toBe(failure)
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'usda', op: 'byBarcode', kind: 'unavailable', status: 502 }),
      expect.any(String)
    )
    expect(error).not.toHaveBeenCalled()
  })

  it('warns on rate limiting too', async () => {
    const failure = new ExternalSourceError('usda', 'rate_limited', 'limit', { status: 429 })
    await expect(withSourceLogging(source({ byId: vi.fn(() => Promise.reject(failure)) })).byId('1')).rejects.toBe(
      failure
    )
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ kind: 'rate_limited' }), expect.any(String))
  })

  it('logs a misconfiguration at error with the FatSecret apiCode, never as a code field', async () => {
    const failure = new ExternalSourceError('fatsecret', 'unavailable', 'API error 21', {
      apiCode: 21,
      misconfigured: true
    })
    const wrapped = withSourceLogging(source({ key: 'fatsecret', search: vi.fn(() => Promise.reject(failure)) }))
    await expect(wrapped.search('oats', 5)).rejects.toBe(failure)
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'fatsecret', apiCode: 21 }),
      expect.any(String)
    )
    expect(error.mock.calls[0]![0]).not.toHaveProperty('code')
    expect(warn).not.toHaveBeenCalled()
  })

  it('logs one line a minute per failure shape and counts the ones it held back', async () => {
    vi.useFakeTimers()
    const failure = new ExternalSourceError('usda', 'unavailable', 'timed out')
    const wrapped = withSourceLogging(source({ search: vi.fn(() => Promise.reject(failure)) }))
    for (let i = 0; i < 3; i++) await wrapped.search('q', 5).catch(() => undefined)
    expect(warn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60_001)
    await wrapped.search('q', 5).catch(() => undefined)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[1]![0]).toMatchObject({ suppressed: 2 })
  })
})
