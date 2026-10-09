import type { SessionCategoryDot, WorkoutSessionSummary } from '../types/workout'

export interface DayDots {
  dots: SessionCategoryDot[]
  more: boolean
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10)

export function monthRange(month: string): { from: string, to: string } {
  const [year, monthIndex] = month.split('-').map(Number) as [number, number]
  return {
    from: isoDay(new Date(Date.UTC(year, monthIndex - 1, 1 - 7))),
    to: isoDay(new Date(Date.UTC(year, monthIndex, 7)))
  }
}

export function calendarDots(
  sessions: Pick<WorkoutSessionSummary, 'performedOn' | 'categories'>[],
  max = 4
): Map<string, DayDots> {
  const byDay = new Map<string, SessionCategoryDot[]>()
  for (const session of sessions) {
    if (!session.categories.length) continue
    const dots = byDay.get(session.performedOn) ?? []
    for (const dot of session.categories) if (!dots.some((d) => d.id === dot.id)) dots.push(dot)
    byDay.set(session.performedOn, dots)
  }
  return new Map([...byDay].map(([day, dots]) => [day, { dots: dots.slice(0, max), more: dots.length > max }]))
}
