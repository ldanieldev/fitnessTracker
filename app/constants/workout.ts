import type { DistanceUnit } from '~/types/workout'

export const STANDARD_PLATES = [45, 35, 25, 10, 5, 2.5] as const
export const DEFAULT_BAR_WEIGHT = 45

export const DISTANCE_UNITS: { label: string; value: DistanceUnit }[] = [
  { label: 'km', value: 'km' },
  { label: 'mi', value: 'mi' },
  { label: 'm', value: 'm' }
]

export const MOCK_EXERCISES = [
  { id: 1, name: 'Barbell Bench Press', type: 'strength' as const },
  { id: 2, name: 'Squats', type: 'strength' as const },
  { id: 3, name: 'Treadmill', type: 'cardio' as const },
  { id: 4, name: 'Deadlift', type: 'strength' as const },
  { id: 5, name: 'Overhead Press', type: 'strength' as const },
  { id: 6, name: 'Barbell Row', type: 'strength' as const },
  { id: 7, name: 'Stationary Bike', type: 'cardio' as const },
  { id: 8, name: 'Elliptical', type: 'cardio' as const },
  { id: 9, name: 'Dumbbell Curl', type: 'strength' as const },
  { id: 10, name: 'Lat Pulldown', type: 'strength' as const }
]
