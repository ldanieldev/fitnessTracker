import { shiftDate } from '~~/shared/utils/nutritionSummary'

export function weekOf(date: string): string[] {
  const d = new Date(`${date}T00:00:00`)
  const offset = (d.getDay() + 6) % 7
  const monday = shiftDate(date, -offset)
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i))
}

export function shiftWeek(date: string, weeks: number): string {
  return shiftDate(date, weeks * 7)
}

const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

export function formatMonthTitle(date: string): string {
  return MONTH_FORMAT.format(new Date(`${date}T00:00:00`))
}
