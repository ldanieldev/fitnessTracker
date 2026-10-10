import type { StepDay, StepTarget, StepWeek, StepWeekDay } from '../types/steps'
import { shiftDate } from './nutritionSummary'

export const STEPS_MAX = 200_000
export const STEP_WEEKS_MAX = 520

export function formatSteps(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('en-US')
}

export function formatStepsCompact(value: number): string {
  return Math.abs(value) >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : String(Math.round(value))
}

export function stepCounts(weeks: StepWeek[]): Record<string, number> {
  return Object.fromEntries(weeks.flatMap((w) => w.days.flatMap((d) => (d.steps === null ? [] : [[d.date, d.steps]]))))
}

export function stepTargetOn(targets: StepTarget[], date: string): StepTarget | null {
  let best: StepTarget | null = null
  for (const t of targets) {
    if (t.effectiveFrom <= date && (!best || t.effectiveFrom > best.effectiveFrom)) best = t
  }
  return best
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

export function summarizeWeek(start: string, days: StepDay[], targets: StepTarget[], today: string): StepWeek {
  const counts = new Map(days.map((d) => [d.date, d.steps]))
  const rows: StepWeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDate(start, i)
    return { date, steps: counts.get(date) ?? null, target: stepTargetOn(targets, date)?.dailyTarget ?? null }
  })
  const end = rows[6]!.date
  const logged = rows.filter((r) => r.steps !== null)
  const total = sum(logged.map((r) => r.steps!))
  const targeted = rows.filter((r) => r.target !== null)
  const budget = targeted.length ? sum(targeted.map((r) => r.target!)) : null
  const judged = logged.filter((r) => r.target !== null)
  const met = judged.length ? sum(judged.map((r) => r.steps!)) >= sum(judged.map((r) => r.target!)) : null
  const remaining = start <= today && today <= end && budget !== null ? Math.max(budget - total, 0) : null
  const openDays = remaining !== null ? rows.filter((r) => r.date >= today && r.steps === null).length : null
  const neededPerDay = remaining !== null && openDays ? Math.ceil(remaining / openDays) : null
  return {
    start,
    end,
    days: rows,
    total,
    logged: logged.length,
    average: logged.length ? Math.round(total / logged.length) : null,
    budget,
    met,
    remaining,
    openDays,
    neededPerDay
  }
}

export function stepsPaceText(week: StepWeek): string | null {
  if (week.remaining === null) return null
  if (week.remaining === 0) return 'Budget reached'
  if (week.neededPerDay === null || !week.openDays) return `${formatSteps(week.remaining)} short`
  const unit = week.openDays === 1 ? 'day' : 'days'
  return `${formatSteps(week.remaining)} left · ${week.openDays} ${unit} → ${formatSteps(week.neededPerDay)}/day`
}
