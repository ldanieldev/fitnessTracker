import { describe, expect, it } from 'vitest'
import { msUntilNextMidnight } from '../../app/utils/nutrition/today'

describe('msUntilNextMidnight', () => {
  it('returns about a second when called right before midnight', () => {
    const now = new Date(2026, 8, 12, 23, 59, 59, 0)
    expect(msUntilNextMidnight(now)).toBe(1000)
  })

  it('returns a full day when called exactly at midnight', () => {
    const now = new Date(2026, 8, 12, 0, 0, 0, 0)
    const expected = new Date(2026, 8, 13, 0, 0, 0, 0).getTime() - now.getTime()
    expect(msUntilNextMidnight(now)).toBe(expected)
    expect(expected).toBeGreaterThan(23 * 60 * 60 * 1000)
    expect(expected).toBeLessThan(25 * 60 * 60 * 1000)
  })
})
