import type { LoadStyle, TrackingType } from '../types/workout'

export const TRACKING_TYPE_LABELS: Record<TrackingType, string> = {
  weight_reps: 'Weight + Reps',
  distance_time: 'Distance + Time',
  weight_distance: 'Weight + Distance',
  weight_time: 'Weight + Time',
  reps_distance: 'Reps + Distance',
  reps_time: 'Reps + Time',
  weight: 'Weight',
  reps: 'Reps',
  distance: 'Distance',
  time: 'Time'
}

export const LOAD_STYLE_LABELS: Record<LoadStyle, string> = {
  plain: 'Plain',
  barbell: 'Barbell',
  assisted: 'Assisted'
}

export const WEIGHT_TRACKING_TYPES: TrackingType[] = ['weight_reps', 'weight_distance', 'weight_time', 'weight']
