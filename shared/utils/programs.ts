import type { PhaseSpan, PositionInput, ProgramPosition, StartWhen } from '../types/program'
import type { CategoryColor } from './categoryColors'
import { CATEGORY_DOT_CLASS } from './categoryColors'
import { shiftDate } from './nutritionSummary'

const DAY_MS = 86_400_000

export const PHASE_COLORS: CategoryColor[] = ['sky', 'amber', 'emerald', 'violet', 'rose', 'teal', 'orange', 'indigo']

export const phaseColorClass = (index: number): string =>
  CATEGORY_DOT_CLASS[PHASE_COLORS[index % PHASE_COLORS.length]!]!

export function weekStartOf(date: string, weekStart: 0 | 1): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return shiftDate(date, -((day - weekStart + 7) % 7))
}

export function anchorFor(when: StartWhen, today: string, weekStart: 0 | 1): string {
  const start = weekStartOf(today, weekStart)
  return when === 'now' ? start : shiftDate(start, 7)
}

function weeksBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (7 * DAY_MS))
}

export function programPosition<P extends PhaseSpan>(input: PositionInput<P>): ProgramPosition<P> {
  const totalWeeks = input.phases.reduce((sum, phase) => sum + phase.weeks, 0)
  const between = input.today < input.anchorDate
  const week = between
    ? input.anchorWeek
    : input.anchorWeek + weeksBetween(input.anchorDate, weekStartOf(input.today, input.weekStart))

  let start = 1
  for (const [index, phase] of input.phases.entries()) {
    if (week < start + phase.weeks) {
      return {
        state: between ? 'between' : 'current',
        week,
        totalWeeks,
        phase,
        phaseIndex: index,
        weekInPhase: week - start + 1
      }
    }
    start += phase.weeks
  }
  return { state: 'finished', week, totalWeeks, phase: null, phaseIndex: -1, weekInPhase: 0 }
}
