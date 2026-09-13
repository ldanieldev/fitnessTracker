import { describe, expect, it } from 'vitest'

describe('week', () => {
  it('returns the Monday-start week containing the date and shifts by whole weeks', async () => {
    const { weekOf, shiftWeek, formatMonthTitle } = await import('../../app/utils/nutrition/week')
    expect(weekOf('2026-09-10', 1)).toEqual(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'])
    expect(weekOf('2026-09-13', 1)[0]).toBe('2026-09-07')
    expect(shiftWeek('2026-09-10', -1)).toBe('2026-09-03')
    expect(formatMonthTitle('2026-09-10')).toBe('September 2026')
  })

  it('returns the Sunday-start week containing the date, including the boundary days', async () => {
    const { weekOf } = await import('../../app/utils/nutrition/week')
    expect(weekOf('2026-09-10', 0)).toEqual(['2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'])
    expect(weekOf('2026-09-10', 0)[0]).toBe('2026-09-06')
    // Saturday (2026-09-12) is the last day of its Sunday-start week.
    expect(weekOf('2026-09-12', 0)[0]).toBe('2026-09-06')
    expect(weekOf('2026-09-12', 0)[6]).toBe('2026-09-12')
    // Sunday (2026-09-13) starts the next Sunday-start week.
    expect(weekOf('2026-09-13', 0)[0]).toBe('2026-09-13')
  })
})
