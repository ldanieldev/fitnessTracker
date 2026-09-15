import { timeOf } from './entryEdit'

export function deriveMealTime(stored: string | null, entries: Array<{ loggedAt: string }>): string | null {
  if (stored !== null) return stored
  if (entries.length === 0) return null
  const earliest = entries.reduce((min, e) => (e.loggedAt < min.loggedAt ? e : min))
  return timeOf(earliest.loggedAt)
}
