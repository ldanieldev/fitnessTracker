import { describe, expect, it } from 'vitest'
import {
  bodyweightStats,
  calendarColumns,
  calendarWeekStarts,
  countByWeek,
  dashboardCacheKey,
  dayStreak,
  liftGoalProgress,
  liftStats,
  longestDayRun,
  longestRun,
  rankTrained,
  weekMet,
  weekStreak,
  weekTarget
} from '../../shared/utils/dashboard'
import { weeksBetween } from '../../shared/utils/programs'

describe('dashboardCacheKey', () => {
  it('versions the key and includes part, user, today and week start', () => {
    expect(dashboardCacheKey('consistency', 7, '2026-10-11', 0)).toBe('dashboard:v4:consistency:7:2026-10-11:0')
    expect(dashboardCacheKey('bodyweight', 7, '2026-10-12', 1)).toBe('dashboard:v4:bodyweight:7:2026-10-12:1')
  })
})

const TODAY = '2026-10-11'

describe('calendarWeekStarts / calendarColumns', () => {
  it('ends with the current week, Sunday start', () => {
    const starts = calendarWeekStarts(TODAY, 0)
    expect(starts).toHaveLength(12)
    expect(starts[0]).toBe('2026-07-26')
    expect(starts[11]).toBe('2026-10-11')
  })

  it('Monday start shifts every column', () => {
    expect(calendarWeekStarts(TODAY, 1)[0]).toBe('2026-07-20')
    expect(calendarWeekStarts(TODAY, 1)[11]).toBe('2026-10-05')
  })

  it('labels the first column of each month and skips a late-month first column', () => {
    expect(calendarColumns(TODAY, 0).map((c) => c.month)).toEqual([
      null, 'Aug', null, null, null, null, 'Sep', null, null, null, 'Oct', null
    ])
    expect(calendarColumns(TODAY, 1)[0]!.month).toBe('Jul')
  })

  it('lists seven days per column and flags future days', () => {
    const last = calendarColumns(TODAY, 0).at(-1)!
    expect(last.days.map((d) => d.date)).toEqual([
      '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'
    ])
    expect(last.days.map((d) => d.future)).toEqual([false, true, true, true, true, true, true])
  })
})

describe('weeksBetween', () => {
  it('counts whole weeks', () => {
    expect(weeksBetween('2026-09-27', '2026-10-11')).toBe(2)
    expect(weeksBetween('2026-10-11', '2026-10-11')).toBe(0)
  })
})

describe('bodyweightStats', () => {
  it('averages the last completed week, compares with 4 weeks before and builds weekly points', () => {
    const points = [
      { date: '2026-09-06', value: 185 },
      { date: '2026-10-09', value: 181 },
      { date: '2026-10-10', value: 180 },
      { date: '2026-10-11', value: 179 }
    ]
    expect(bodyweightStats(points, TODAY, 0)).toEqual({
      current: 180.5,
      change: -4.5,
      week: { from: '2026-10-04', to: '2026-10-10' },
      series: [185, 180.5],
      daily: [181, 180, 179]
    })
  })

  it('reads the week from the user\'s week start, matching a Sunday check-in', () => {
    const points = [
      { date: '2026-10-04', value: 182 },
      { date: '2026-10-05', value: 181 },
      { date: '2026-10-11', value: 220 },
      { date: '2026-10-17', value: 219.2 },
      { date: '2026-10-18', value: 219 }
    ]
    expect(bodyweightStats(points, TODAY, 1)).toMatchObject({
      current: 182,
      week: { from: '2026-09-28', to: '2026-10-04' }
    })
    expect(bodyweightStats(points, '2026-10-18', 0)).toMatchObject({
      current: 219.6,
      week: { from: '2026-10-11', to: '2026-10-17' }
    })
  })

  it('averages the latest reading of a day with two weigh-ins, given latest first as the series returns them', () => {
    const points = [
      { date: '2026-10-14', value: 220 },
      { date: '2026-10-14', value: 220.4 },
      { date: '2026-10-15', value: 219 }
    ]
    expect(bodyweightStats(points, '2026-10-18', 0).current).toBe(219.5)
    expect(bodyweightStats(points, '2026-10-18', 0).daily).toEqual([220, 219])
  })

  it('has no average when the last completed week is empty', () => {
    expect(bodyweightStats([{ date: '2026-10-11', value: 190 }], TODAY, 0)).toEqual({
      current: null,
      change: null,
      week: { from: '2026-10-04', to: '2026-10-10' },
      series: [],
      daily: [190]
    })
    expect(bodyweightStats([], TODAY, 0)).toMatchObject({ current: null, change: null, series: [], daily: [] })
  })

  it('keeps daily readings from the last 14 days, today included', () => {
    const points = [
      { date: '2026-09-27', value: 184 },
      { date: '2026-09-28', value: 183 },
      { date: '2026-10-11', value: 180 }
    ]
    expect(bodyweightStats(points, TODAY, 0).daily).toEqual([183, 180])
  })
})

describe('weekTarget', () => {
  const program = {
    week: 2,
    currentWeekStart: '2026-10-11',
    phases: [
      { weeks: 1, deload: false, routine: { dayCount: 4 } },
      { weeks: 1, deload: true, routine: { dayCount: 3 } },
      { weeks: 1, deload: false, routine: null },
      { weeks: 1, deload: false, routine: { dayCount: 0 } }
    ]
  }

  it('uses the phase routine for program weeks and the setting before the program', () => {
    expect(weekTarget('2026-10-04', program, 3)).toEqual({ target: 4, source: 'program' })
    expect(weekTarget('2026-09-27', program, 3)).toEqual({ target: 3, source: 'setting' })
  })

  it('treats deload, off and empty-routine phases as a zero target', () => {
    expect(weekTarget('2026-10-11', program, 3)).toEqual({ target: 0, source: 'program' })
    expect(weekTarget('2026-10-11', { ...program, week: 3 }, 3)).toEqual({ target: 0, source: 'program' })
    expect(weekTarget('2026-10-11', { ...program, week: 4 }, 3)).toEqual({ target: 0, source: 'program' })
  })

  it('falls back to the setting past the program and without one', () => {
    expect(weekTarget('2026-10-11', { ...program, week: 5 }, 3)).toEqual({ target: 3, source: 'setting' })
    expect(weekTarget('2026-10-11', null, 2)).toEqual({ target: 2, source: 'setting' })
  })
})

describe('countByWeek / weekMet / weekStreak / longestRun', () => {
  it('groups days by week start', () => {
    expect(Object.fromEntries(countByWeek(['2026-10-05', '2026-10-06', '2026-10-11'], 0))).toEqual({
      '2026-10-04': 2,
      '2026-10-11': 1
    })
  })

  it('judges a week, leaving the in-progress week and pre-history weeks open', () => {
    expect(weekMet(2, 3, false, false)).toBe(false)
    expect(weekMet(3, 3, false, false)).toBe(true)
    expect(weekMet(0, 0, false, false)).toBe(true)
    expect(weekMet(1, 3, true, false)).toBeNull()
    expect(weekMet(3, 3, true, false)).toBe(true)
    expect(weekMet(5, 3, false, true)).toBeNull()
  })

  it('counts the streak back from last week, adding the current week once met', () => {
    expect(weekStreak([null, true, false, true, true, null])).toBe(2)
    expect(weekStreak([true, true, true])).toBe(3)
    expect(weekStreak([true, true, false, null])).toBe(0)
    expect(weekStreak([])).toBe(0)
  })

  it('finds the longest run', () => {
    expect(longestRun([true, true, false, true, true, true, null])).toBe(3)
    expect(longestRun([null, false])).toBe(0)
  })
})

describe('dayStreak / longestDayRun', () => {
  it('counts back from today, or from yesterday when today is not logged yet', () => {
    expect(dayStreak(['2026-10-08', '2026-10-09', '2026-10-10'], TODAY)).toBe(3)
    expect(dayStreak(['2026-10-08', '2026-10-09', '2026-10-10', TODAY], TODAY)).toBe(4)
    expect(dayStreak(['2026-10-09', TODAY], TODAY)).toBe(1)
    expect(dayStreak([], TODAY)).toBe(0)
  })

  it('finds the longest consecutive run', () => {
    expect(longestDayRun(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-05', '2026-09-06'])).toBe(3)
    expect(longestDayRun([])).toBe(0)
  })
})

describe('liftStats / liftGoalProgress / rankTrained', () => {
  const points = [
    { date: '2026-06-01', value: 150 },
    { date: '2026-07-25', value: 200 },
    { date: '2026-08-01', value: 205 },
    { date: '2026-09-30', value: 220 },
    { date: '2026-10-08', value: 225 }
  ]

  it('takes the best of the last 4 weeks, compares with the first 4 weeks and buckets weekly', () => {
    expect(liftStats(points, TODAY, false)).toEqual({ value: 225, change: 20, series: [200, 205, 220, 225] })
  })

  it('uses minimums when lower is better', () => {
    expect(liftStats(points, TODAY, true)).toEqual({ value: 220, change: 20, series: [200, 205, 220, 225] })
  })

  it('falls back to the latest value and returns null without points in the window', () => {
    expect(liftStats([{ date: '2026-08-01', value: 205 }], TODAY, false)).toEqual({
      value: 205,
      change: 0,
      series: [205]
    })
    expect(liftStats([{ date: '2026-06-01', value: 150 }], TODAY, false)).toBeNull()
  })

  it('measures goal progress from the first value in either direction', () => {
    expect(liftGoalProgress(205, 225, 245, false)).toBe(0.5)
    expect(liftGoalProgress(205, 250, 245, false)).toBe(1)
    expect(liftGoalProgress(205, 200, 245, false)).toBe(0)
    expect(liftGoalProgress(100, 90, 80, true)).toBe(0.5)
    expect(liftGoalProgress(245, 245, 245, false)).toBe(1)
  })

  it('is complete once the target is reached and empty when the first value already passed it', () => {
    expect(liftGoalProgress(110, 95, 100, false)).toBe(0)
    expect(liftGoalProgress(110, 100, 100, false)).toBe(1)
    expect(liftGoalProgress(70, 85, 80, true)).toBe(0)
    expect(liftGoalProgress(90, 80, 80, true)).toBe(1)
    expect(liftGoalProgress(90, 75, 80, true)).toBe(1)
    expect(liftGoalProgress(70, 75, 80, false)).toBe(0.5)
  })

  it('ranks by sessions, then name', () => {
    const rows = [
      { exerciseId: 1, name: 'Squat', sessions: 3 },
      { exerciseId: 2, name: 'Bench', sessions: 3 },
      { exerciseId: 3, name: 'Row', sessions: 5 }
    ]
    expect(rankTrained(rows).map((r) => r.exerciseId)).toEqual([3, 2, 1])
  })
})
