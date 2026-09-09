import { describe, expect, it } from 'vitest'

describe('enumerateDates', () => {
  it('returns an inclusive range', async () => {
    const { enumerateDates } = await import('../../shared/utils/nutritionSummary')
    expect(enumerateDates('2026-01-01', '2026-01-04'))
      .toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'])
  })

  it('crosses a month boundary', async () => {
    const { enumerateDates } = await import('../../shared/utils/nutritionSummary')
    expect(enumerateDates('2026-01-30', '2026-02-02'))
      .toEqual(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'])
  })

  it('handles a leap day', async () => {
    const { enumerateDates } = await import('../../shared/utils/nutritionSummary')
    expect(enumerateDates('2028-02-28', '2028-03-01'))
      .toEqual(['2028-02-28', '2028-02-29', '2028-03-01'])
  })

  it('rejects a reversed range', async () => {
    const { enumerateDates } = await import('../../shared/utils/nutritionSummary')
    expect(() => enumerateDates('2026-01-04', '2026-01-01')).toThrow(/before/i)
  })
})

describe('shiftDate', () => {
  it('advances a day', async () => {
    const { shiftDate } = await import('../../shared/utils/nutritionSummary')
    expect(shiftDate('2026-07-01', 1)).toBe('2026-07-02')
  })

  it('crosses a month boundary backwards', async () => {
    const { shiftDate } = await import('../../shared/utils/nutritionSummary')
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('handles a leap day', async () => {
    const { shiftDate } = await import('../../shared/utils/nutritionSummary')
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('crosses a year boundary', async () => {
    const { shiftDate } = await import('../../shared/utils/nutritionSummary')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('rollingAverage', () => {
  it('averages a full trailing window', async () => {
    const { rollingAverage } = await import('../../shared/utils/nutritionSummary')
    expect(rollingAverage([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5])
  })

  it('is null until the window is full', async () => {
    const { rollingAverage } = await import('../../shared/utils/nutritionSummary')
    expect(rollingAverage([1, 2], 3)).toEqual([null, null])
  })

  it('EXCLUDES unlogged days rather than treating them as zero', async () => {
    const { rollingAverage } = await import('../../shared/utils/nutritionSummary')
    // 1800 and 1900 logged, one day unlogged: the mean is 1850, not 1233
    expect(rollingAverage([1800, null, 1900], 3)).toEqual([null, null, 1850])
  })

  it('returns null when the whole window is unlogged', async () => {
    const { rollingAverage } = await import('../../shared/utils/nutritionSummary')
    expect(rollingAverage([null, null, null], 3)).toEqual([null, null, null])
  })
})
