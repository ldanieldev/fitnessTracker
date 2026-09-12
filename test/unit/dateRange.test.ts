import { describe, expect, it } from 'vitest'
import { formatRange } from '../../app/utils/dateRange'

describe('formatRange', () => {
  it('formats a same-year range without repeating the year', () => {
    const today = new Date('2026-09-12T00:00:00')
    const start = new Date('2026-08-30T00:00:00')
    const end = new Date('2026-09-12T00:00:00')
    expect(formatRange(start, end, today)).toBe('Aug 30 – Sep 12')
  })

  it('formats a cross-year range with a year on each date', () => {
    const today = new Date('2026-09-12T00:00:00')
    const start = new Date('2025-08-30T00:00:00')
    const end = new Date('2026-09-12T00:00:00')
    expect(formatRange(start, end, today)).toBe('Aug 30, 2025 – Sep 12, 2026')
  })

  it('formats a single date in the current year without a year', () => {
    const today = new Date('2026-09-12T00:00:00')
    const start = new Date('2026-09-12T00:00:00')
    expect(formatRange(start, undefined, today)).toBe('Sep 12')
  })

  it('formats a single date outside the current year with a year', () => {
    const today = new Date('2026-09-12T00:00:00')
    const start = new Date('2025-09-12T00:00:00')
    expect(formatRange(start, undefined, today)).toBe('Sep 12, 2025')
  })
})
