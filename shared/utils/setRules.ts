import type { SetMeasures, TrackingType } from '../types/workout'

export type SetMeasure = 'weight' | 'reps' | 'distance' | 'duration'

const MEASURES: Record<TrackingType, SetMeasure[]> = {
  weight_reps: ['weight', 'reps'],
  distance_time: ['distance', 'duration'],
  weight_distance: ['weight', 'distance'],
  weight_time: ['weight', 'duration'],
  reps_distance: ['reps', 'distance'],
  reps_time: ['reps', 'duration'],
  weight: ['weight'],
  reps: ['reps'],
  distance: ['distance'],
  time: ['duration']
}

export const FIELD: Record<SetMeasure, keyof SetMeasures> = {
  weight: 'weight',
  reps: 'reps',
  distance: 'distanceMeters',
  duration: 'durationSeconds'
}

export const LABEL: Record<SetMeasure, string> = {
  weight: 'Weight',
  reps: 'Reps',
  distance: 'Distance',
  duration: 'Duration'
}

export function measuresFor(trackingType: TrackingType): SetMeasure[] {
  return MEASURES[trackingType]
}

export function validateSetInput(trackingType: TrackingType, input: SetMeasures): string | null {
  const used = measuresFor(trackingType)
  for (const measure of used) {
    const value = input[FIELD[measure]]
    if (value === undefined || value === null) return `${LABEL[measure]} is required`
    if (value <= 0) return `${LABEL[measure]} must be greater than zero`
  }
  for (const measure of Object.keys(FIELD) as SetMeasure[]) {
    if (used.includes(measure)) continue
    const value = input[FIELD[measure]]
    if (value !== undefined && value !== null) return `${LABEL[measure]} does not apply to this exercise`
  }
  return null
}
