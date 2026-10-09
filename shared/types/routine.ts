import type { EntryTarget, TrackingType } from './workout'

export interface RoutineSummary {
  id: number
  name: string
  active: boolean
  dayCount: number
  nextDay: { id: number; name: string } | null
}

export interface RoutineEntry {
  id: number
  exerciseId: number
  exerciseName: string
  trackingType: TrackingType
  deleted: boolean
  sortOrder: number
  target: EntryTarget | null
  supersetGroup: number | null
  optional: boolean
  restSeconds: number | null
  notes: string | null
}

export interface RoutineDay {
  id: number
  name: string
  description: string | null
  floating: boolean
  sortOrder: number
  entries: RoutineEntry[]
}

export interface Routine {
  id: number
  name: string
  notes: string | null
  active: boolean
  nextDayId: number | null
  days: RoutineDay[]
}

export interface RoutineEntryPatch {
  targetSets?: number | null
  targetLow?: number | null
  targetHigh?: number | null
  targetWeight?: number | null
  optional?: boolean
  restSeconds?: number | null
  notes?: string | null
  sortOrder?: number
  supersetGroup?: null
}
