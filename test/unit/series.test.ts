import { describe, expect, it } from 'vitest'

describe('series — ranges', () => {
  it('maps a range preset to a start date, and "all" to null', async () => {
    const { rangeStart } = await import('../../shared/utils/series')
    expect(rangeStart('1m', '2026-09-16')).toBe('2026-08-17')
    expect(rangeStart('1y', '2026-09-16')).toBe('2025-09-16')
    expect(rangeStart('all', '2026-09-16')).toBeNull()
  })

  it('maps "mtd" to the first of the month, including on the first itself', async () => {
    const { rangeStart } = await import('../../shared/utils/series')
    expect(rangeStart('mtd', '2026-09-16')).toBe('2026-09-01')
    expect(rangeStart('mtd', '2026-09-01')).toBe('2026-09-01')
    expect(rangeStart('mtd', '2026-01-31')).toBe('2026-01-01')
  })

  it('counts days between ISO dates', async () => {
    const { daysBetween, dayIndex } = await import('../../shared/utils/series')
    expect(daysBetween('2026-09-01', '2026-09-16')).toBe(15)
    expect(daysBetween('2026-09-16', '2026-09-01')).toBe(-15)
    expect(dayIndex('1970-01-02')).toBe(1)
  })
})

describe('series — buckets and trend', () => {
  it('buckets by week honouring the week start, latest reading per week wins', async () => {
    const { bucketWeekly, weekBucket } = await import('../../shared/utils/series')
    // 2026-09-16 is a Wednesday
    expect(weekBucket('2026-09-16', 1)).toBe('2026-09-14')
    expect(weekBucket('2026-09-16', 0)).toBe('2026-09-13')
    expect(weekBucket('2026-09-14', 1)).toBe('2026-09-14')
    expect(weekBucket('2026-09-13', 1)).toBe('2026-09-07')
    const points = [
      { date: '2026-09-08', value: 200 }, { date: '2026-09-10', value: 199 },
      { date: '2026-09-15', value: 198 }, { date: '2026-09-16', value: 197.5 }
    ]
    expect(bucketWeekly(points, 1)).toEqual([{ date: '2026-09-07', value: 199 }, { date: '2026-09-14', value: 197.5 }])
  })

  it('builds a 7-day trailing trend over calendar days, tolerating gaps', async () => {
    const { buildTrend } = await import('../../shared/utils/series')
    const points = [1, 2, 3, 4, 5, 6, 7, 8].map((d) => ({ date: `2026-09-0${d}`, value: 200 - d }))
    const trend = buildTrend(points, 'day', '2026-09-01', '2026-09-08')
    expect(trend[0]).toEqual({ date: '2026-09-07', value: 196 }) // mean of 199..193
    expect(trend[1]).toEqual({ date: '2026-09-08', value: 195 })
    const gappyPoints = [{ date: '2026-09-01', value: 200 }, { date: '2026-09-10', value: 190 }]
    const gappy = buildTrend(gappyPoints, 'day', '2026-09-01', '2026-09-10')
    // days 7–10: the window holds only the readings inside it; day 7 sees just Sep 1, day 10 sees just Sep 10
    expect(gappy.find((p) => p.date === '2026-09-07')?.value).toBe(200)
    expect(gappy.find((p) => p.date === '2026-09-10')?.value).toBe(190)
  })

  it('uses a 4-bucket window for weekly series', async () => {
    const { buildTrend } = await import('../../shared/utils/series')
    const weeks = [0, 1, 2, 3, 4].map((i) => ({ date: `2026-0${i + 1}-05`, value: 200 - i }))
    const trend = buildTrend(weeks, 'week', '2026-01-05', '2026-05-05')
    expect(trend.map((p) => p.value)).toEqual([198.5, 197.5])
  })
})
