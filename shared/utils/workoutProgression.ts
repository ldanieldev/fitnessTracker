import type { EntryTarget, LoadStyle, SetMeasures, WorkoutEntry } from '../types/workout'
import { formatTargetRange } from './workoutTargets'

export interface Progression {
  kind: 'add' | 'drop'
  weight: number
  fromWeight: number
  reps: number
}

const DEFAULT_INCREMENT = 5

export function progressionFor(
  entry: Pick<WorkoutEntry, 'trackingType' | 'loadStyle' | 'weightIncrement' | 'target' | 'sets' | 'lastSets'>,
  deload: boolean
): Progression | null {
  const low = entry.target?.low ?? null
  const high = entry.target?.high ?? null
  if (entry.trackingType !== 'weight_reps' || low === null || high === null || low >= high) return null
  const seq: SetMeasures[] = [...entry.lastSets, ...entry.sets]
  const trigger = seq.at(-1)
  if (trigger?.weight == null || trigger.reps == null) return null

  const assisted = entry.loadStyle === 'assisted'
  const heavier = (a: number, b: number) => (assisted ? a < b : a > b)
  const top = (set: SetMeasures) => set.reps != null && set.reps >= high
  const failedBump = (prev: SetMeasures, set: SetMeasures) =>
    top(prev) &&
    prev.weight != null &&
    set.weight != null &&
    set.reps != null &&
    heavier(set.weight, prev.weight) &&
    set.reps < low

  const prev = seq.at(-2)
  if (prev && failedBump(prev, trigger)) {
    return { kind: 'drop', weight: prev.weight!, fromWeight: trigger.weight, reps: trigger.reps }
  }
  if (!top(trigger) || deload) return null
  for (let i = Math.max(entry.lastSets.length, 1); i < seq.length; i++) {
    if (failedBump(seq[i - 1]!, seq[i]!)) return null
  }
  const step = entry.weightIncrement ?? DEFAULT_INCREMENT
  const weight = Math.round((assisted ? trigger.weight - step : trigger.weight + step) * 100) / 100
  if (weight <= 0) return null
  return { kind: 'add', weight, fromWeight: trigger.weight, reps: trigger.reps }
}

export interface ProgressionCopy {
  title: string
  body: string
  bodyParts: { before: string; range: string; after: string }
  apply: string
  stay: string
}

export function progressionCopy(
  progression: Progression,
  loadStyle: LoadStyle | null,
  target: EntryTarget | null
): ProgressionCopy {
  const assisted = loadStyle === 'assisted'
  const { kind, weight, fromWeight, reps } = progression
  const range = formatTargetRange('reps', target?.low ?? null, target?.high ?? null)
  const step = Math.round(Math.abs(weight - fromWeight) * 100) / 100
  const stay = `Stay at ${fromWeight} lb`
  if (kind === 'add') {
    return {
      title: assisted ? 'Less assist?' : 'Add weight?',
      body: `You hit ${reps} reps at ${fromWeight} lb — the top of ${range}.`,
      bodyParts: { before: `You hit ${reps} reps at ${fromWeight} lb — the top of `, range, after: '.' },
      apply: assisted ? `Less assist → ${weight} lb` : `Add ${step} lb → ${weight} lb`,
      stay
    }
  }
  return {
    title: assisted ? 'More assist?' : 'Drop back?',
    body: `${reps} reps at ${fromWeight} lb is below ${range}.`,
    bodyParts: { before: `${reps} reps at ${fromWeight} lb is below `, range, after: '.' },
    apply: assisted ? `More assist → ${weight} lb` : `Drop to ${weight} lb`,
    stay
  }
}
