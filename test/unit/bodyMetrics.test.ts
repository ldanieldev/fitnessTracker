import { describe, expect, it } from 'vitest'

describe('bodyMetrics — formatting', () => {
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
    const gain = { targetValue: 210, startValue: 200 }
    expect(goalProgress(gain, 205)).toEqual({ remaining: 5, percent: 0.5, reached: false })
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
    const trend = Array.from({ length: 30 }, (_, i) => (
      { date: `2026-09-${String(i + 1).padStart(2, '0')}`, value: 200 - i * 0.1 }
    ))
    expect(actualPace(trend)).toBeCloseTo(-0.7, 6)
    expect(actualPace([{ date: '2026-09-01', value: 200 }])).toBeNull()
    expect(onTrack(-0.9, -1.0)).toBe(true)
    expect(onTrack(-0.9, -0.5)).toBe(false)
    expect(onTrack(-0.9, 0.3)).toBe(false)
    expect(onTrack(null, -1)).toBeNull()
    expect(onTrack(0, 0)).toBe(true)
  })
})
