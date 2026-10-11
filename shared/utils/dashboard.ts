import type { CalendarColumn, DashboardPart, LiftPoint, ProgramWindow } from '../types/dashboard'
import { shiftDate } from './nutritionSummary'
import { weekStartOf, weeksBetween } from './programs'

export const CALENDAR_WEEKS = 12
export const BODYWEIGHT_DAILY_DAYS = 14
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const round1 = (value: number) => Math.round(value * 10) / 10

export function calendarWeekStarts(today: string, weekStart: 0 | 1, count = CALENDAR_WEEKS): string[] {
  const last = weekStartOf(today, weekStart)
  return Array.from({ length: count }, (_, i) => shiftDate(last, -7 * (count - 1 - i)))
}

export function calendarColumns(today: string, weekStart: 0 | 1, count = CALENDAR_WEEKS): CalendarColumn[] {
  let previous = -1
  return calendarWeekStarts(today, weekStart, count).map((start, index) => {
    const month = Number(start.slice(5, 7)) - 1
    const label = month !== previous && (index > 0 || Number(start.slice(8, 10)) <= 21) ? MONTHS[month]! : null
    previous = month
    const days = Array.from({ length: 7 }, (_, k) => {
      const date = shiftDate(start, k)
      return { date, future: date > today }
    })
    return { start, month: label, days }
  })
}

function averageEnding(byDate: Map<string, number>, end: string): number | null {
  const values: number[] = []
  for (let k = 0; k < 7; k++) {
    const value = byDate.get(shiftDate(end, -k))
    if (value !== undefined) values.push(value)
  }
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

export function bodyweightStats(points: LiftPoint[], today: string) {
  const byDate = new Map(points.map((p) => [p.date, p.value]))
  const current = averageEnding(byDate, today)
  const before = averageEnding(byDate, shiftDate(today, -28))
  const dailyFrom = shiftDate(today, -(BODYWEIGHT_DAILY_DAYS - 1))
  const series = Array.from({ length: CALENDAR_WEEKS }, (_, i) =>
    averageEnding(byDate, shiftDate(today, -7 * (CALENDAR_WEEKS - 1 - i)))
  ).flatMap((value) => (value === null ? [] : [round1(value)]))
  return {
    current: current === null ? null : round1(current),
    change: current !== null && before !== null ? round1(current - before) : null,
    series,
    daily: points.filter((p) => p.date >= dailyFrom).map((p) => p.value)
  }
}

export function weekTarget(
  start: string,
  program: ProgramWindow | null,
  setting: number
): { target: number; source: 'program' | 'setting' } {
  if (program) {
    const week = program.week - weeksBetween(start, program.currentWeekStart)
    let end = 0
    for (const phase of program.phases) {
      end += phase.weeks
      if (week >= 1 && week <= end) {
        const days = phase.deload ? 0 : (phase.routine?.dayCount ?? 0)
        return { target: days, source: 'program' }
      }
    }
  }
  return { target: setting, source: 'setting' }
}

export function countByWeek(days: string[], weekStart: 0 | 1): Map<string, number> {
  const counts = new Map<string, number>()
  for (const day of days) {
    const key = weekStartOf(day, weekStart)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

export function weekMet(count: number, target: number, current: boolean, beforeHistory: boolean): boolean | null {
  if (beforeHistory) return null
  if (current) return count >= target ? true : null
  return count >= target
}

export function weekStreak(mets: (boolean | null)[]): number {
  let streak = 0
  for (let i = mets.length - 1; i >= 0; i--) {
    if (mets[i] === true) streak++
    else if (i === mets.length - 1 && mets[i] === null) continue
    else break
  }
  return streak
}

export function longestRun(mets: (boolean | null)[]): number {
  let best = 0
  let run = 0
  for (const met of mets) {
    run = met === true ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

export function dayStreak(days: string[], today: string): number {
  const logged = new Set(days)
  let day = logged.has(today) ? today : shiftDate(today, -1)
  let streak = 0
  while (logged.has(day)) {
    streak++
    day = shiftDate(day, -1)
  }
  return streak
}

export function longestDayRun(sortedDays: string[]): number {
  let best = 0
  let run = 0
  let previous: string | null = null
  for (const day of sortedDays) {
    run = previous !== null && shiftDate(previous, 1) === day ? run + 1 : 1
    best = Math.max(best, run)
    previous = day
  }
  return best
}

export function liftStats(points: LiftPoint[], today: string, lowerIsBetter: boolean) {
  const from = shiftDate(today, -(CALENDAR_WEEKS * 7 - 1))
  const inWindow = points.filter((p) => p.date >= from && p.date <= today)
  if (!inWindow.length) return null
  const best = (values: number[]) => (lowerIsBetter ? Math.min(...values) : Math.max(...values))
  const recent = inWindow.filter((p) => p.date >= shiftDate(today, -27)).map((p) => p.value)
  const early = inWindow.filter((p) => p.date <= shiftDate(today, -56)).map((p) => p.value)
  const value = recent.length ? best(recent) : inWindow.at(-1)!.value
  const series = Array.from({ length: CALENDAR_WEEKS }, (_, i) => {
    const end = shiftDate(today, -7 * (CALENDAR_WEEKS - 1 - i))
    const start = shiftDate(end, -6)
    const values = inWindow.filter((p) => p.date >= start && p.date <= end).map((p) => p.value)
    return values.length ? best(values) : null
  }).flatMap((v) => (v === null ? [] : [round1(v)]))
  return { value: round1(value), change: early.length ? round1(value - best(early)) : null, series }
}

export function liftGoalProgress(first: number, value: number, target: number, lowerIsBetter: boolean): number {
  const reached = (v: number) => (lowerIsBetter ? v <= target : v >= target)
  if (reached(value)) return 1
  if (reached(first)) return 0
  return Math.min(1, Math.max(0, (value - first) / (target - first)))
}

export function rankTrained<T extends { exerciseId: number; name: string; sessions: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
}

export function dashboardCacheKey(part: DashboardPart, userId: number, today: string, weekStart: 0 | 1): string {
  return `dashboard:v3:${part}:${userId}:${today}:${weekStart}`
}
