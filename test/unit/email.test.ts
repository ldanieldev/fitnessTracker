import { describe, expect, it } from 'vitest'
import { emailSchema, normalizeEmail } from '../../shared/utils/email'

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Foo.Bar@Example.COM ')).toBe('foo.bar@example.com')
  })
})

describe('emailSchema', () => {
  it('normalises before validating, so padded mixed-case input passes', () => {
    expect(emailSchema.parse(' Foo@Example.com ')).toBe('foo@example.com')
  })
  it('still rejects a non-email', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false)
  })
})
