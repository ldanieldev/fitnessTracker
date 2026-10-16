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
})
