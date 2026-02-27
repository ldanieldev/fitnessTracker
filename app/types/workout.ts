export interface WorkoutSet {
  setNumber: number
  weight: number
  reps: number
  rpe: number
  note: string
  logged: boolean
}

export type DistanceUnit = 'km' | 'mi' | 'm'

export interface CardioLog {
  durationMinutes: number | undefined
  distance: number | undefined
  distanceUnit: DistanceUnit
  calories: number | undefined
  logged: boolean
}

export interface WorkoutExercise {
  id: number
  name: string
  type: 'strength' | 'cardio'
  sets: WorkoutSet[]
  cardioLog: CardioLog
  collapsed: boolean
}

export interface PlateCount {
  weight: number
  count: number
}
