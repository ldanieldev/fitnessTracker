export const TRACKING_TYPE_VALUES = [
  'weight_reps',
  'distance_time',
  'weight_distance',
  'weight_time',
  'reps_distance',
  'reps_time',
  'weight',
  'reps',
  'distance',
  'time'
] as const
export type TrackingType = (typeof TRACKING_TYPE_VALUES)[number]

export const LOAD_STYLE_VALUES = ['plain', 'barbell', 'assisted'] as const
export type LoadStyle = (typeof LOAD_STYLE_VALUES)[number]

export interface ExerciseCategory {
  id: number
  key: string | null
  name: string
  color: string
  sortOrder: number
  shared: boolean
  hidden: boolean
}

export interface ExerciseDetail extends Exercise {
  instructions: string[]
  variations: { id: number, name: string }[]
}

export interface Exercise {
  id: number
  name: string
  category: ExerciseCategory
  trackingType: TrackingType
  loadStyle: LoadStyle | null
  barWeight: number | null
  weightIncrement: number | null
  restSeconds: number | null
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null
  equipment: string[]
  primaryMuscles: string[]
  secondaryMuscles: string[]
  images: string[]
  notes: string | null
  link: string | null
  favorite: boolean
  hidden: boolean
  shared: boolean
  overridden: { category: boolean, trackingType: boolean, loadStyle: boolean, barWeight: boolean }
}

export interface ExerciseRow {
  id: number
  name: string
  categoryId: number
  trackingType: TrackingType
  loadStyle: LoadStyle | null
  barWeight: string | null
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null
  images: string[]
  instructions: string[]
  createdByUserId: number | null
  equipment: string[]
  primaryMuscles: string[]
  secondaryMuscles: string[]
}

export interface ExercisePrefRow {
  barWeight: string | null
  trackingType: TrackingType | null
  loadStyle: LoadStyle | null
  categoryId: number | null
  weightIncrement: string | null
  restSeconds: number | null
  notes: string | null
  link: string | null
  favorite: boolean
  hiddenAt: Date | null
}

export interface CategoryRow {
  id: number
  userId: number | null
  key: string | null
  name: string
  color: string
  sortOrder: number
}

export interface MuscleRow {
  key: string
  name: string
  categoryKey: string
  bodyMapGroups: string[]
}

export interface EquipmentRow {
  key: string
  name: string
}

export interface CategoryPrefRow {
  name: string | null
  color: string | null
  sortOrder: number | null
  hiddenAt: Date | null
}

export interface ExerciseListFilters {
  q?: string
  categoryId?: number
  muscles?: string[]
  equipment?: string[]
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | null
  favorites?: boolean
  includeHidden?: boolean
  limit?: number
}

export interface SetMeasures {
  weight?: number | null
  reps?: number | null
  distanceMeters?: number | null
  durationSeconds?: number | null
}

export type SetRecordKind = 'weight_reps' | 'reps' | 'distance' | 'pace'

export interface SetRecord {
  kind: SetRecordKind
  previous: number | null
}

export interface WorkoutSet extends SetMeasures {
  id: number
  sortOrder: number
  done: boolean
  comment: string | null
  records: SetRecord[]
}

export interface WorkoutEntry {
  id: number
  exerciseId: number
  exerciseName: string
  sortOrder: number
  trackingType: TrackingType
  loadStyle: LoadStyle | null
  barWeight: number | null
  weightIncrement: number | null
  notes: string | null
  sets: WorkoutSet[]
  lastSets: SetMeasures[]
}

export interface WorkoutSession {
  id: number
  name: string | null
  performedOn: string
  startedAt: string
  endedAt: string | null
  notes: string | null
  entries: WorkoutEntry[]
}

export interface WorkoutSessionSummary {
  id: number
  name: string | null
  performedOn: string
  startedAt: string
  endedAt: string | null
  exerciseCount: number
  setCount: number
}
