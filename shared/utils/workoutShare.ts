import { format } from 'date-fns'
import type { WorkoutEntry, WorkoutSession } from '../types/workout'
import { formatSet } from './setFormat'
import { measuresFor } from './setRules'
import { supersetLabel } from './supersets'
import { durationLabel } from './workoutTime'

function entryLines(entry: WorkoutEntry, label: string | null): string[] {
  const measures = measuresFor(entry.trackingType)
  const sign = entry.loadStyle === 'assisted' ? -1 : 1
  const sets = entry.sets.map((set) => {
    const text = formatSet(measures, { ...set, weight: set.weight == null ? set.weight : set.weight * sign })
    return set.comment ? `${text} (${set.comment})` : text
  })
  return [label ? `${label} ${entry.exerciseName}` : entry.exerciseName, `  ${sets.join(', ')}`]
}

export function workoutShareText(session: WorkoutSession): string {
  const date = format(new Date(`${session.performedOn}T00:00:00`), 'EEE, MMM d')
  let title = `${session.name ?? 'Workout'} — ${date}`
  if (session.endedAt) title += ` · ${durationLabel(session.startedAt, new Date(session.endedAt).getTime())}`
  const head = session.notes ? [title, `Note: ${session.notes}`] : [title]
  const body = session.entries
    .filter((entry) => entry.sets.length > 0)
    .flatMap((entry) => entryLines(entry, supersetLabel(session.entries, entry.id)))
  return [...head, '', ...body].join('\n')
}
