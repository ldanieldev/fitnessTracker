import pino from 'pino'
import { DrizzleQueryError } from 'drizzle-orm/errors'
import { describe, expect, it } from 'vitest'
import { redaction } from '../../server/utils/logger'
import { redactEventQueryParams, redactQueryParams } from '../../server/utils/redactQueryParams'

function capture() {
  const lines: string[] = []
  const log = pino(redaction, { write: (line: string) => lines.push(line) })
  return { log, text: () => lines.join('\n') }
}

describe('redactQueryParams', () => {
  it('replaces the params line of a DrizzleQueryError message and keeps the SQL', () => {
    const err = new DrizzleQueryError('select * from users where email = $1', ['a@b.c', 'line1\nline2'])
    expect(redactQueryParams(err.message))
      .toBe('Failed query: select * from users where email = $1\nparams: [Redacted]')
  })

  it('stops at the stack frames', () => {
    const err = new DrizzleQueryError('select $1', ['hunter2'])
    const redacted = redactQueryParams(err.stack)!
    expect(redacted).not.toContain('hunter2')
    expect(redacted).toMatch(/params: \[Redacted\]\n\s+at /)
  })

  it('redacts every params section when two failed queries share one text', () => {
    const inner = new DrizzleQueryError('select $1', ['first-secret'])
    const outer = new DrizzleQueryError('select $2', ['second-secret'], inner)
    const redacted = redactQueryParams(`${outer.stack}\ncaused by: ${inner.stack}`)!
    expect(redacted).not.toContain('first-secret')
    expect(redacted).not.toContain('second-secret')
    expect(redacted.match(/params: \[Redacted\]/g)).toHaveLength(2)
  })

  it('leaves other text and non-strings alone', () => {
    expect(redactQueryParams('plain message')).toBe('plain message')
    expect(redactQueryParams(undefined)).toBeUndefined()
  })
})

describe('redactEventQueryParams', () => {
  it('scrubs the exception values and message of a Sentry event', () => {
    const { message } = new DrizzleQueryError('select $1', ['hunter2'])
    const event = redactEventQueryParams({ message, exception: { values: [{ value: message }, {}] } })
    expect(JSON.stringify(event)).not.toContain('hunter2')
    expect(event.exception.values[0]!.value).toBe('Failed query: select $1\nparams: [Redacted]')
  })
})

describe('logger redaction', () => {
  it('drops query params from a logged DrizzleQueryError, directly or as a cause', () => {
    const { log, text } = capture()
    const err = new DrizzleQueryError('insert into users values ($1, $2)', ['hunter2', 'secret@example.com'])
    log.error({ err }, 'insert failed')
    log.error({ err: new Error('wrapped', { cause: err }) }, 'wrapped failed')
    expect(text()).not.toContain('hunter2')
    expect(text()).not.toContain('secret@example.com')
    expect(text()).toContain('params: [Redacted]')
  })

  it('drops the params of both DrizzleQueryErrors in one cause chain', () => {
    const { log, text } = capture()
    const inner = new DrizzleQueryError('select $1', ['first-secret'])
    log.error({ err: new DrizzleQueryError('select $2', ['second-secret'], inner) }, 'chained failure')
    expect(text()).not.toContain('first-secret')
    expect(text()).not.toContain('second-secret')
  })

  it('censors credentials and auth headers', () => {
    const { log, text } = capture()
    log.info({
      password: 'pw-top',
      body: { password: 'pw-nested', token: 'tok-nested', accessToken: 'at', refreshToken: 'rt' },
      req: { headers: { authorization: 'Bearer mfj_abc', cookie: 'nuxt-session=xyz' } }
    }, 'request')
    for (const secret of ['pw-top', 'pw-nested', 'tok-nested', '"at"', '"rt"', 'mfj_abc', 'nuxt-session=xyz']) {
      expect(text()).not.toContain(secret)
    }
  })
  it('censors email, ip, OAuth code and token fields but keeps err.code', () => {
    const { log, text } = capture()
    log.warn({
      email: 'top@example.com',
      ip: '203.0.113.9',
      code: 'oauth-code-top',
      secret: 'shh-top',
      user: { email: 'nested@example.com', ip: '198.51.100.7', secret: 'shh-nested' },
      query: { code: 'oauth-code-nested' },
      body: { access_token: 'at-nested', refresh_token: 'rt-nested' },
      err: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })
    }, 'redaction')
    for (const value of [
      'top@example.com', '203.0.113.9', 'oauth-code-top', 'shh-top', 'nested@example.com', '198.51.100.7',
      'shh-nested', 'oauth-code-nested', 'at-nested', 'rt-nested'
    ]) {
      expect(text()).not.toContain(value)
    }
    expect(JSON.parse(text()).err.code).toBe('ECONNREFUSED')
  })

  it('drops the data of an h3 error, directly or as a cause', async () => {
    const { createError } = await import('h3')
    const inner = createError({ statusCode: 401, data: { code: 'oauth-code', state: 'oauth-state' } })
    const outer = createError({ statusCode: 500, data: { access_token: 'gho_secret' }, cause: inner })
    const { log, text } = capture()
    log.error({ err: outer }, 'oauth failed')
    for (const value of ['oauth-code', 'oauth-state', 'gho_secret']) expect(text()).not.toContain(value)
    expect(JSON.parse(text()).err.statusCode).toBe(500)
  })
})
