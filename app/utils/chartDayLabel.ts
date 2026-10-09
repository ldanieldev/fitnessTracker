import { format } from 'date-fns'

export function chartDayLabel(date: string) {
  return format(new Date(`${date}T00:00:00`), 'MMM d')
}
