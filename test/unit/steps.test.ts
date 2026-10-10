import { describe, expect, it } from 'vitest'
import type { StepDay, StepTarget } from '../../shared/types/steps'
import {
  STEP_WEEKS_MAX,
  formatSteps,
  formatStepsCompact,
  stepCounts,
  stepTargetOn,
  stepsPaceText,
  summarizeWeek
} from '../../shared/utils/steps'

const SUN = '2026-10-04'
const days = (counts: (number | null)[], start = SUN): StepDay[] =>
  counts.flatMap((steps, i) => {
    if (steps === null) return []
    const d = new Date(`${start}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i)
    return [{ date: d.toISOString().slice(0, 10), steps }]
  })
const eight: StepTarget[] = [{ dailyTarget: 8000, effectiveFrom: '2026-01-01' }]
const PAST = '2026-10-20'

describe('formatSteps', () => {
  it('groups thousands and shows null as an em dash', () => {
    expect(formatSteps(56346)).toBe('56,346')
    expect(formatSteps(200000)).toBe('200,000')
    expect(formatSteps(0)).toBe('0')
    expect(formatSteps(null)).toBe('—')
  })
})

describe('formatStepsCompact', () => {
  it('keeps small counts whole and abbreviates thousands', () => {
    expect(formatStepsCompact(0)).toBe('0')
    expect(formatStepsCompact(500)).toBe('500')
    expect(formatStepsCompact(2500)).toBe('2.5k')
    expect(formatStepsCompact(20000)).toBe('20k')
    expect(formatStepsCompact(200000)).toBe('200k')
  })
})

describe('stepCounts', () => {
  it('maps every logged day across weeks and skips unlogged ones', () => {
    const a = summarizeWeek(SUN, days([100, null, 300]), eight, PAST)
    const b = summarizeWeek('2026-09-27', days([5], '2026-09-27'), eight, PAST)
    expect(stepCounts([a, b])).toEqual({ '2026-10-04': 100, '2026-10-06': 300, '2026-09-27': 5 })
    expect(stepCounts([])).toEqual({})
  })
})

describe('STEP_WEEKS_MAX', () => {
  it('is 520', () => {
    expect(STEP_WEEKS_MAX).toBe(520)
  })
})

describe('stepTargetOn', () => {
  it('picks the latest target on or before the date, regardless of order', () => {
    const targets = [
      { dailyTarget: 9000, effectiveFrom: '2026-10-07' },
      { dailyTarget: 8000, effectiveFrom: '2026-09-01' },
      { dailyTarget: 10000, effectiveFrom: '2026-12-01' }
    ]
    expect(stepTargetOn(targets, '2026-10-06')?.dailyTarget).toBe(8000)
    expect(stepTargetOn(targets, '2026-10-07')?.dailyTarget).toBe(9000)
    expect(stepTargetOn(targets, '2026-11-30')?.dailyTarget).toBe(9000)
    expect(stepTargetOn(targets, '2026-08-31')).toBeNull()
    expect(stepTargetOn([], '2026-10-07')).toBeNull()
  })
})

describe('summarizeWeek', () => {
  it('lays out seven days from the start and totals a full week', () => {
    const week = summarizeWeek(SUN, days([8000, 9000, 7000, 8500, 7500, 8200, 8000]), eight, PAST)
    expect(week.start).toBe(SUN)
    expect(week.end).toBe('2026-10-10')
    expect(week.days.map((d) => d.date)).toEqual([
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10'
    ])
    expect(week.total).toBe(56200)
    expect(week.logged).toBe(7)
    expect(week.average).toBe(8029)
    expect(week.budget).toBe(56000)
    expect(week.met).toBe(true)
    expect(week.remaining).toBeNull()
    expect(week.openDays).toBeNull()
    expect(week.neededPerDay).toBeNull()
  })

  it('works for a Monday start', () => {
    const week = summarizeWeek('2026-10-05', [], eight, PAST)
    expect(week.end).toBe('2026-10-11')
  })

  it('averages only logged days and judges met against those days', () => {
    const hit = summarizeWeek(SUN, days([9000, null, 9000, null, 6000, null, null]), eight, PAST)
    expect(hit.logged).toBe(3)
    expect(hit.total).toBe(24000)
    expect(hit.average).toBe(8000)
    expect(hit.budget).toBe(56000)
    expect(hit.met).toBe(true)
    expect(hit.days[1]).toEqual({ date: '2026-10-05', steps: null, target: 8000 })

    const miss = summarizeWeek(SUN, days([7000, 7000]), eight, PAST)
    expect(miss.met).toBe(false)
  })

  it('uses the target in force on each day when it changes mid-week', () => {
    const targets = [...eight, { dailyTarget: 9000, effectiveFrom: '2026-10-07' }]
    const week = summarizeWeek(SUN, days([8000, 8000, 8000, 9000]), targets, PAST)
    expect(week.days.map((d) => d.target)).toEqual([8000, 8000, 8000, 9000, 9000, 9000, 9000])
    expect(week.budget).toBe(60000)
    expect(week.met).toBe(true)
  })

  it('a target that starts mid-week only covers its days', () => {
    const targets = [{ dailyTarget: 8000, effectiveFrom: '2026-10-06' }]
    const week = summarizeWeek(SUN, days([2000, null, 8000]), targets, PAST)
    expect(week.days[0]!.target).toBeNull()
    expect(week.budget).toBe(40000)
    expect(week.met).toBe(true)
  })

  it('leaves budget, met and pace null without a target', () => {
    const week = summarizeWeek(SUN, days([5000]), [], '2026-10-05')
    expect(week.total).toBe(5000)
    expect(week.average).toBe(5000)
    expect(week.budget).toBeNull()
    expect(week.met).toBeNull()
    expect(week.remaining).toBeNull()
    expect(week.openDays).toBeNull()
    expect(week.neededPerDay).toBeNull()
  })

  it('reports nothing logged as zero total and null average/met', () => {
    const week = summarizeWeek(SUN, [], eight, PAST)
    expect(week.total).toBe(0)
    expect(week.logged).toBe(0)
    expect(week.average).toBeNull()
    expect(week.met).toBeNull()
    expect(week.budget).toBe(56000)
  })

  it('spreads the remaining budget over the open days from today in the current week', () => {
    const wed = '2026-10-07'
    const before = summarizeWeek(SUN, days([8000, 8000, 8000]), eight, wed)
    expect(before.remaining).toBe(32000)
    expect(before.openDays).toBe(4)
    expect(before.neededPerDay).toBe(8000)

    const after = summarizeWeek(SUN, days([8000, 8000, 8000, 4000]), eight, wed)
    expect(after.remaining).toBe(28000)
    expect(after.openDays).toBe(3)
    expect(after.neededPerDay).toBe(9334)
  })

  it('clamps remaining at zero once the budget is passed', () => {
    const week = summarizeWeek(SUN, days([20000, 20000, 20000]), eight, '2026-10-06')
    expect(week.remaining).toBe(0)
    expect(week.neededPerDay).toBe(0)
  })

  it('has no pace for a future week', () => {
    const week = summarizeWeek(SUN, [], eight, '2026-10-03')
    expect(week.remaining).toBeNull()
    expect(week.openDays).toBeNull()
    expect(week.neededPerDay).toBeNull()
  })

  it('counts every day as open on the first day of the week', () => {
    const week = summarizeWeek(SUN, [], eight, SUN)
    expect(week.remaining).toBe(56000)
    expect(week.openDays).toBe(7)
    expect(week.neededPerDay).toBe(8000)
  })

  it('counts an unlogged last day as the single open day', () => {
    const week = summarizeWeek(SUN, days([8000, 8000, 8000, 8000, 8000, 8000]), eight, '2026-10-10')
    expect(week.remaining).toBe(8000)
    expect(week.openDays).toBe(1)
    expect(week.neededPerDay).toBe(8000)
  })

  it('no open days left gives a null needed-per-day', () => {
    const sat = '2026-10-10'
    const week = summarizeWeek(SUN, days([7000, 7000, 7000, 7000, 7000, 7000, 7000]), eight, sat)
    expect(week.remaining).toBe(7000)
    expect(week.openDays).toBe(0)
    expect(week.neededPerDay).toBeNull()
  })
})

describe('stepsPaceText', () => {
  const base = summarizeWeek(SUN, days([8000, 8000, 8000]), eight, '2026-10-07')

  it('describes what is left and the per-day pace', () => {
    expect(stepsPaceText(base)).toBe('32,000 left · 4 days → 8,000/day')
    const lastDay = summarizeWeek(SUN, days([8000, 8000, 8000, 8000, 8000, 8000]), eight, '2026-10-10')
    expect(stepsPaceText(lastDay)).toBe('8,000 left · 1 day → 8,000/day')
  })

  it('says the budget is reached, or how far short a closed week is', () => {
    expect(stepsPaceText({ ...base, remaining: 0, neededPerDay: 0 })).toBe('Budget reached')
    expect(stepsPaceText({ ...base, remaining: 7000, openDays: 0, neededPerDay: null })).toBe('7,000 short')
  })

  it('is null outside the current week or without a target', () => {
    expect(stepsPaceText(summarizeWeek(SUN, [], eight, PAST))).toBeNull()
    expect(stepsPaceText(summarizeWeek(SUN, [], [], '2026-10-07'))).toBeNull()
  })
})
