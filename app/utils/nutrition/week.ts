import { shiftDate } from '~~/shared/utils/nutritionSummary'

export function weekOf(date: string, weekStart: 0 | 1): string[] {
  const d = new Date(`${date}T00:00:00`)
  const offset = (d.getDay() - weekStart + 7) % 7
  const start = shiftDate(date, -offset)
  return Array.from({ length: 7 }, (_, i) => shiftDate(start, i))
}

export function shiftWeek(date: string, weeks: number): string {
  return shiftDate(date, weeks * 7)
}

const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

export function formatMonthTitle(date: string): string {
  return MONTH_FORMAT.format(new Date(`${date}T00:00:00`))
}
