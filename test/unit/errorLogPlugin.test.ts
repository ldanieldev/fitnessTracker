import { createError, type H3Event } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../server/utils/logger'

vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)
const { default: plugin } = await import('../../server/plugins/errorLog')

type ErrorHook = (err: unknown, context: { event?: H3Event }) => void

function errorHook(): ErrorHook {
  let hook: ErrorHook | undefined
  plugin({ hooks: { hook: (_name: string, fn: ErrorHook) => (hook = fn) } } as never)
  return hook!
}

const event = {
  method: 'POST',
  path: '/api/users/7?x=1',
  context: { matchedRoute: { path: '/api/users/:id' }, userId: 7 }
} as unknown as H3Event

afterEach(() => vi.restoreAllMocks())

describe('errorLog plugin', () => {
  it('ignores H3 errors below 500', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
    errorHook()(createError({ statusCode: 404 }), { event })
    expect(error).not.toHaveBeenCalled()
  })

  it('logs a 5xx with its route and user, flagged as already captured by Sentry', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const err = new Error('boom')
    errorHook()(err, { event })
    expect(error).toHaveBeenCalledWith(
      { err, method: 'POST', route: '/api/users/:id', userId: 7, sentryCaptured: true },
      'unhandled server error'
    )
  })

  it('ignores a 5xx marked as an expected failure', async () => {
    const { expectedFailure } = await import('../../server/utils/expectedFailure')
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
    errorHook()(expectedFailure({ statusCode: 502, statusMessage: 'source down' }), { event })
    expect(error).not.toHaveBeenCalled()
  })

  it('logs an error raised outside a request', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
    errorHook()(new Error('plugin failed'), {})
    expect(error).toHaveBeenCalledOnce()
  })
})
