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

export interface KnownStepDay {
  steps: number
  partial: boolean
}

export function stepCounts(weeks: StepWeek[]): Record<string, KnownStepDay> {
  return Object.fromEntries(
    weeks.flatMap((w) =>
      w.days.flatMap((d) => (d.steps === null ? [] : [[d.date, { steps: d.steps, partial: d.partial }]]))
    )
  )
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
  const byDate = new Map(days.map((d) => [d.date, d]))
  const rows: StepWeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDate(start, i)
    const day = byDate.get(date)
    return {
      date,
      steps: day?.steps ?? null,
      partial: day?.partial ?? false,
      target: stepTargetOn(targets, date)?.dailyTarget ?? null
    }
  })
  const end = rows[6]!.date
  const logged = rows.filter((r) => r.steps !== null)
  // Partial days' steps really happened, so they count in the total, but a part-day would drag the average down.
  const full = logged.filter((r) => !r.partial)
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
    partial: logged.length - full.length,
    average: full.length ? Math.round(sum(full.map((r) => r.steps!)) / full.length) : null,
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
