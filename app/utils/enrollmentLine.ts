import { format } from 'date-fns'
import type { Enrollment } from '~~/shared/types/program'

export function shortDate(iso: string): string {
  return format(new Date(`${iso}T00:00:00`), 'EEE, MMM d')
}

export function enrollmentLine(e: Enrollment): string {
  if (e.state === 'finished') return 'Program complete'
  if (e.state === 'paused') return `Paused at week ${e.week} of ${e.totalWeeks}`
  if (e.state === 'between') return `Starts ${shortDate(e.anchorDate)} · Week ${e.week} of ${e.totalWeeks}`
  return `Week ${e.week} of ${e.totalWeeks}${e.phase ? ` · ${e.phase.name}` : ''}`
}

export function enrollmentBadge(e: Enrollment): string | null {
  if (e.state === 'finished' || !e.phase) return null
  if (!e.phase.routine) return 'Rest week'
  return e.phase.deload ? 'Deload' : null
}
