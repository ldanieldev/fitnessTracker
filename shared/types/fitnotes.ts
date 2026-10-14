import type { TrackingType } from './workout'

export interface FitNotesExerciseOption {
  id: number
  name: string
  custom: boolean
}

export interface FitNotesPreviewExercise {
  name: string
  category: string
  sets: number
  days: number
  firstDate: string
  lastDate: string
  trackingType: TrackingType
  assisted: boolean
  match: FitNotesExerciseOption | null
  suggestions: FitNotesExerciseOption[]
}

export interface FitNotesPreview {
  sets: number
  days: number
  firstDate: string | null
  lastDate: string | null
  /** Export dates that already have a workout logged in the app, not counting earlier imports. */
  existingDays: number
  /** Export dates an earlier FitNotes import already brought in; a re-import always skips them. */
  importedDays: number
  exercises: FitNotesPreviewExercise[]
}

export interface FitNotesImportResult {
  daysImported: number
  daysSkippedImported: number
  daysSkippedExisting: number
  sets: number
  exercisesCreated: number
  categoriesCreated: number
}

export type FitNotesMapping = Record<string, number | null>
