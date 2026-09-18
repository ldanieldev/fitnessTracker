import type { LoadStyle, SetMeasures, SetRecord, SetRecordKind, TrackingType } from '../types/workout'
import { measuresFor } from './setRules'

export interface HistorySet extends SetMeasures {
  id: number
}

export function paceOf(measures: SetMeasures): number | null {
  const { distanceMeters, durationSeconds } = measures
  if (distanceMeters == null || durationSeconds == null) return null
  return distanceMeters / durationSeconds
}

function maxRecord(
  value: number | null | undefined,
  previousValues: (number | null | undefined)[],
  kind: SetRecordKind
): SetRecord | null {
  if (value == null) return null
  const defined = previousValues.filter((v): v is number => v != null)
  if (defined.length === 0) return { kind, previous: null }
  const best = Math.max(...defined)
  return value > best ? { kind, previous: best } : null
}

// LG-R19: a set is a record unless an earlier set dominates it on both weight and reps; an equal set dominates, so ties never win.
function weightRepsRecord(set: HistorySet, history: HistorySet[], assisted: boolean): SetRecord | null {
  const { weight, reps } = set
  if (weight == null || reps == null) return null
  const earlier = history.filter((h): h is HistorySet & { weight: number, reps: number } => h.weight != null && h.reps != null)
  const loadWins = (earlierWeight: number) => (assisted ? earlierWeight <= weight : earlierWeight >= weight)
  if (earlier.some((h) => loadWins(h.weight) && h.reps >= reps)) return null
  const candidates = earlier.filter((h) => h.reps >= reps).map((h) => h.weight)
  if (candidates.length === 0) return { kind: 'weight_reps', previous: null }
  return { kind: 'weight_reps', previous: assisted ? Math.min(...candidates) : Math.max(...candidates) }
}

function paceRecord(set: HistorySet, history: HistorySet[]): SetRecord | null {
  const pace = paceOf(set)
  if (pace == null) return null
  return maxRecord(pace, history.map((h) => paceOf(h)), 'pace')
}

export function recordsFor(
  set: HistorySet,
  history: HistorySet[],
  trackingType: TrackingType,
  loadStyle: LoadStyle | null
): SetRecord[] {
  const others = history.filter((h) => h.id !== set.id)
  const measures = measuresFor(trackingType)
  const records: SetRecord[] = []

  if (measures.includes('weight') && measures.includes('reps')) {
    const record = weightRepsRecord(set, others, loadStyle === 'assisted')
    if (record) records.push(record)
  }

  if (measures.length === 1 && measures[0] === 'reps') {
    const record = maxRecord(set.reps, others.map((h) => h.reps), 'reps')
    if (record) records.push(record)
  }

  if (measures.includes('distance')) {
    const record = maxRecord(set.distanceMeters, others.map((h) => h.distanceMeters), 'distance')
    if (record) records.push(record)
  }

  if (measures.includes('distance') && measures.includes('duration')) {
    const record = paceRecord(set, others)
    if (record) records.push(record)
  }

  return records
}

// history must already be chronological; "earlier" is the prefix before the set's own index, not rows with a lower id.
export function recordsForEarlier(
  history: HistorySet[],
  setId: number,
  trackingType: TrackingType,
  loadStyle: LoadStyle | null
): SetRecord[] {
  const index = history.findIndex((h) => h.id === setId)
  const set = history[index]
  if (!set) return []
  return recordsFor(set, history.slice(0, index), trackingType, loadStyle)
}
