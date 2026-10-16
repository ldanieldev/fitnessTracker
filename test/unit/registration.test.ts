import { describe, expect, it } from 'vitest'
import { registrationAllowed } from '../../server/utils/registration'

describe('registrationAllowed', () => {
  it('allows sign-ups while open', () => {
    expect(registrationAllowed('open', true)).toBe(true)
  })
  it('refuses sign-ups while closed once an account exists', () => {
    expect(registrationAllowed('closed', true)).toBe(false)
  })
  it('lets a fresh instance create its first account even while closed', () => {
    expect(registrationAllowed('closed', false)).toBe(true)
  })
  it('ignores case and padding', () => {
    expect(registrationAllowed(' Open', true)).toBe(true)
  })
  it('treats an unrecognised value as closed', () => {
    expect(registrationAllowed('opne', true)).toBe(false)
  })
})
