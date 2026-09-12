import { describe, expect, it } from 'vitest'

describe('week', () => {
  it('returns the ISO week containing the date and shifts by whole weeks', async () => {
    const { weekOf, shiftWeek, formatMonthTitle } = await import('../../app/utils/nutrition/week')
    expect(weekOf('2026-09-10')).toEqual(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'])
    expect(weekOf('2026-09-13')[0]).toBe('2026-09-07')
    expect(shiftWeek('2026-09-10', -1)).toBe('2026-09-03')
    expect(formatMonthTitle('2026-09-10')).toBe('September 2026')
  })
})
