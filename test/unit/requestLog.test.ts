import type { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'
import { requestLogLevel, requestRoute } from '../../server/utils/requestLog'

describe('requestLogLevel', () => {
  it('logs 5xx at error, auth and limit rejections at warn, and the rest at debug', () => {
    const levels = (statuses: number[]) => statuses.map((status) => requestLogLevel(status))
    expect(levels([500, 503])).toEqual(['error', 'error'])
    expect(levels([401, 403, 413, 429])).toEqual(['warn', 'warn', 'warn', 'warn'])
    expect(levels([200, 204, 302, 400, 404])).toEqual(['debug', 'debug', 'debug', 'debug', 'debug'])
  })

  it('logs a 5xx from the Inngest endpoint at warn, since a retried run answers 500', () => {
    expect(requestLogLevel(500, '/api/inngest')).toBe('warn')
    expect(requestLogLevel(500, '/api/users/:id')).toBe('error')
  })
})

describe('requestRoute', () => {
  it('prefers the matched pattern and otherwise drops the query string', () => {
    const event = (path: string, matched?: string) =>
      ({ path, context: matched ? { matchedRoute: { path: matched } } : {} }) as unknown as H3Event
    expect(requestRoute(event('/api/users/7?x=1', '/api/users/:id'))).toBe('/api/users/:id')
    expect(requestRoute(event('/nope?email=a@b.c'))).toBe('/nope')
  })
})
