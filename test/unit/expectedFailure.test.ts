import { createError } from 'h3'
import { describe, expect, it } from 'vitest'
import { expectedFailure, isExpectedFailure } from '../../server/utils/expectedFailure'

describe('expectedFailure', () => {
  it('builds an H3 error carrying the mark, and only that error is recognised', () => {
    const err = expectedFailure({ statusCode: 502, statusMessage: 'source down' })
    expect(err).toMatchObject({ statusCode: 502, statusMessage: 'source down' })
    expect(isExpectedFailure(err)).toBe(true)
    expect(isExpectedFailure(createError({ statusCode: 502 }))).toBe(false)
    expect(isExpectedFailure(new Error('boom'))).toBe(false)
    expect(isExpectedFailure(undefined)).toBe(false)
  })

  it('keeps the mark when h3 normalises the thrown error', () => {
    const err = expectedFailure({ statusCode: 503 })
    expect(isExpectedFailure(createError(err))).toBe(true)
  })

  it('keeps the mark out of the serialised error', () => {
    expect(Object.keys(expectedFailure({ statusCode: 502 }))).not.toContain('my-fitness-journal.expectedFailure')
    expect(JSON.stringify(expectedFailure({ statusCode: 502 }))).not.toContain('expectedFailure')
  })
})
