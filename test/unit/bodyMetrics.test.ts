import { describe, expect, it } from 'vitest'

describe('bodyMetrics — formatting and ranges', () => {
  it('formats values to the type precision and null as an em dash', async () => {
    const { formatValue } = await import('../../shared/utils/bodyMetrics')
    expect(formatValue(197, 1)).toBe('197.0')
    expect(formatValue(21.6249, 2)).toBe('21.62')
    expect(formatValue(null, 1)).toBe('—')
  })

  it('formats deltas with an explicit sign', async () => {
    const { formatDelta } = await import('../../shared/utils/bodyMetrics')
    expect(formatDelta(0.2, 1)).toBe('+0.2')
    expect(formatDelta(-1.8, 1)).toBe('-1.8')
    expect(formatDelta(0, 1)).toBe('0.0')
    expect(formatDelta(null, 1)).toBe('—')
  })

  it('colours a delta by the type direction', async () => {
    const { deltaTone } = await import('../../shared/utils/bodyMetrics')
    expect(deltaTone(-1.8, 'lower')).toBe('success')
    expect(deltaTone(1.8, 'lower')).toBe('error')
    expect(deltaTone(1.8, 'higher')).toBe('success')
    expect(deltaTone(-1.8, 'higher')).toBe('error')
    expect(deltaTone(1.8, 'neutral')).toBe('neutral')
    expect(deltaTone(0, 'lower')).toBe('neutral')
    expect(deltaTone(null, 'lower')).toBe('neutral')
  })

  it('maps a range preset to a start date, and "all" to null', async () => {
    const { rangeStart } = await import('../../shared/utils/bodyMetrics')
    expect(rangeStart('1m', '2026-09-16')).toBe('2026-08-17')
    expect(rangeStart('1y', '2026-09-16')).toBe('2025-09-16')
    expect(rangeStart('all', '2026-09-16')).toBeNull()
  })

  it('maps "mtd" to the first of the month, including on the first itself', async () => {
    const { rangeStart } = await import('../../shared/utils/bodyMetrics')
    expect(rangeStart('mtd', '2026-09-16')).toBe('2026-09-01')
    expect(rangeStart('mtd', '2026-09-01')).toBe('2026-09-01')
    expect(rangeStart('mtd', '2026-01-31')).toBe('2026-01-01')
  })

  it('counts days between ISO dates', async () => {
    const { daysBetween, dayIndex } = await import('../../shared/utils/bodyMetrics')
    expect(daysBetween('2026-09-01', '2026-09-16')).toBe(15)
    expect(daysBetween('2026-09-16', '2026-09-01')).toBe(-15)
    expect(dayIndex('1970-01-02')).toBe(1)
  })
})

describe('bodyMetrics — buckets and trend', () => {
  it('buckets by week honouring the week start, latest reading per week wins', async () => {
    const { bucketWeekly, weekBucket } = await import('../../shared/utils/bodyMetrics')
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
    const { buildTrend } = await import('../../shared/utils/bodyMetrics')
    const points = [1, 2, 3, 4, 5, 6, 7, 8].map((d) => ({ date: `2026-09-0${d}`, value: 200 - d }))
    const trend = buildTrend(points, 'day', '2026-09-01', '2026-09-08')
    expect(trend[0]).toEqual({ date: '2026-09-07', value: 196 }) // mean of 199..193
    expect(trend[1]).toEqual({ date: '2026-09-08', value: 195 })
    const gappy = buildTrend([{ date: '2026-09-01', value: 200 }, { date: '2026-09-10', value: 190 }], 'day', '2026-09-01', '2026-09-10')
    // days 7–10: the window holds only the readings inside it; day 7 sees just Sep 1, day 10 sees just Sep 10
    expect(gappy.find((p) => p.date === '2026-09-07')?.value).toBe(200)
    expect(gappy.find((p) => p.date === '2026-09-10')?.value).toBe(190)
  })

  it('uses a 4-bucket window for weekly series', async () => {
    const { buildTrend } = await import('../../shared/utils/bodyMetrics')
    const weeks = [0, 1, 2, 3, 4].map((i) => ({ date: `2026-0${i + 1}-05`, value: 200 - i }))
    const trend = buildTrend(weeks, 'week', '2026-01-05', '2026-05-05')
    expect(trend.map((p) => p.value)).toEqual([198.5, 197.5])
  })
})

describe('bodyMetrics — goals', () => {
  const cut = { typeId: 1, targetValue: 185, startValue: 200, targetDate: '2026-12-16', startDate: '2026-09-01' }

  it('derives the direction from the goal when one exists', async () => {
    const { effectiveDirection } = await import('../../shared/utils/bodyMetrics')
    expect(effectiveDirection({ direction: 'neutral' }, cut)).toBe('lower')
    expect(effectiveDirection({ direction: 'neutral' }, { targetValue: 210, startValue: 200 })).toBe('higher')
    expect(effectiveDirection({ direction: 'lower' }, null)).toBe('lower')
    expect(effectiveDirection({ direction: 'higher' }, { targetValue: 200, startValue: 200 })).toBe('higher')
  })

  it('measures progress toward a cut and a bulk, clamped, and flags reached', async () => {
    const { goalProgress } = await import('../../shared/utils/bodyMetrics')
    expect(goalProgress(cut, 197)).toEqual({ remaining: -12, percent: 0.2, reached: false })
    expect(goalProgress(cut, 184)).toEqual({ remaining: 1, percent: 1, reached: true })
    expect(goalProgress(cut, 205)).toEqual({ remaining: -20, percent: 0, reached: false })
    expect(goalProgress({ targetValue: 210, startValue: 200 }, 205)).toEqual({ remaining: 5, percent: 0.5, reached: false })
    expect(goalProgress(cut, null)).toEqual({ remaining: null, percent: null, reached: false })
  })

  it('computes the weekly pace a dated goal needs, and none without a future date', async () => {
    const { requiredPace } = await import('../../shared/utils/bodyMetrics')
    expect(requiredPace(cut, 197, '2026-09-16')).toBeCloseTo((-12 / 91) * 7, 6)
    expect(requiredPace({ ...cut, targetDate: null }, 197, '2026-09-16')).toBeNull()
    expect(requiredPace(cut, 197, '2026-12-16')).toBeNull()
    expect(requiredPace(cut, null, '2026-09-16')).toBeNull()
  })

  it('reads the actual pace off the trend slope and judges on-track by sign and magnitude', async () => {
    const { actualPace, onTrack } = await import('../../shared/utils/bodyMetrics')
    const trend = Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, value: 200 - i * 0.1 }))
    expect(actualPace(trend)).toBeCloseTo(-0.7, 6)
    expect(actualPace([{ date: '2026-09-01', value: 200 }])).toBeNull()
    expect(onTrack(-0.9, -1.0)).toBe(true)
    expect(onTrack(-0.9, -0.5)).toBe(false)
    expect(onTrack(-0.9, 0.3)).toBe(false)
    expect(onTrack(null, -1)).toBeNull()
    expect(onTrack(0, 0)).toBe(true)
  })
})
