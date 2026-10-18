import { afterEach, describe, expect, it, vi } from 'vitest'

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock('@sentry/nuxt', () => ({ captureException }))

const { isReportable, reportFailure } = await import('../../app/utils/reportFailure')

const fetchError = (statusCode: number | undefined, message = '[GET] "/api/x": failed') =>
  Object.assign(new Error(message), { name: 'FetchError', statusCode })

describe('reportFailure', () => {
  afterEach(() => {
    captureException.mockClear()
  })

  it('reports 5xx and errors without a status, never 4xx', () => {
    expect(isReportable(fetchError(500))).toBe(true)
    expect(isReportable(fetchError(503))).toBe(true)
    expect(isReportable(fetchError(undefined))).toBe(true)
    expect(isReportable(new TypeError('boom'))).toBe(true)
    expect(isReportable(undefined)).toBe(true)
    expect(isReportable(fetchError(400))).toBe(false)
    expect(isReportable(fetchError(404))).toBe(false)
    expect(isReportable(fetchError(429))).toBe(false)
  })

  it('skips a 4xx without calling Sentry', () => {
    reportFailure(fetchError(404), 'Load food')
    expect(captureException).not.toHaveBeenCalled()
  })

  it('tags the action and status, and strips the query string from the message', () => {
    const err = fetchError(502, '[GET] "/api/workouts/exercises?q=bench%20press&limit=20": 502 Bad Gateway')
    reportFailure(err, 'Search')
    const [sent, hint] = captureException.mock.lastCall!
    expect(hint).toEqual({ tags: { action: 'Search', status: '502' } })
    expect(sent).toBeInstanceOf(Error)
    expect(sent.name).toBe('FetchError')
    expect(sent.message).toBe('[GET] "/api/workouts/exercises": 502 Bad Gateway')
    expect(sent.stack).not.toContain('bench')
  })

  it('reports a network failure with only the action tag', () => {
    reportFailure(fetchError(undefined, '[GET] "/api/x": <no response> Failed to fetch'), 'Load food')
    expect(captureException.mock.lastCall![1]).toEqual({ tags: { action: 'Load food' } })
  })

  it('never forwards a thrown non-Error value', () => {
    reportFailure('secret food text', 'Load food')
    const [sent] = captureException.mock.lastCall!
    expect(sent.name).toBe('string')
    expect(sent.message).toBe('Non-Error thrown')
  })
})
