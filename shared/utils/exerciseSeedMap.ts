import type { LoadStyle, TrackingType } from '../types/workout'

export interface SeedEntry {
  id: string
  name: string
  category: string
  equipment: string | null
  level?: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[] | null
  images: string[] | null
}

export const CATEGORY_SEEDS = [
  { key: 'chest', name: 'Chest', color: 'rose', sortOrder: 0 },
  { key: 'back', name: 'Back', color: 'amber', sortOrder: 1 },
  { key: 'shoulders', name: 'Shoulders', color: 'orange', sortOrder: 2 },
  { key: 'arms', name: 'Arms', color: 'violet', sortOrder: 3 },
  { key: 'legs', name: 'Legs', color: 'emerald', sortOrder: 4 },
  { key: 'core', name: 'Core', color: 'sky', sortOrder: 5 },
  { key: 'neck', name: 'Neck', color: 'slate', sortOrder: 6 },
  { key: 'cardio', name: 'Cardio', color: 'cyan', sortOrder: 7 }
] as const

export const MUSCLE_CATEGORY: Record<string, string> = {
  chest: 'chest',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  traps: 'back',
  shoulders: 'shoulders',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  adductors: 'legs',
  abductors: 'legs',
  abdominals: 'core',
  neck: 'neck'
}

// MuscleMap traces no surface for the neck, so it stays list-only in the filter.
export const MUSCLE_BODY_MAP: Record<string, string[]> = {
  chest: ['CHEST'],
  lats: ['LATS'],
  'middle back': ['RHOMBOIDS'],
  'lower back': ['BACK_LOWER'],
  traps: ['TRAPEZIUS'],
  shoulders: ['SHOULDERS_FRONT', 'SHOULDERS_SIDE', 'SHOULDERS_REAR'],
  biceps: ['BICEPS'],
  triceps: ['TRICEPS'],
  forearms: ['FOREARMS'],
  quadriceps: ['QUADS'],
  hamstrings: ['HAMSTRINGS'],
  glutes: ['GLUTES'],
  calves: ['CALVES'],
  adductors: ['ADDUCTORS'],
  abductors: ['ABDUCTORS'],
  abdominals: ['CORE'],
  neck: []
}

export const EQUIPMENT_KEYS = [
  'bands',
  'barbell',
  'body only',
  'cable',
  'dumbbell',
  'e-z curl bar',
  'exercise ball',
  'foam roll',
  'kettlebells',
  'machine',
  'medicine ball',
  'other'
] as const

const BAR_WEIGHTS: Record<string, number> = { barbell: 45, 'e-z curl bar': 25 }

const WEIGHTLESS_EQUIPMENT = new Set(['body only', 'bands', 'foam roll'])

export function categoryKeyFor(entry: SeedEntry): string {
  if (entry.category === 'cardio') return 'cardio'
  const first = entry.primaryMuscles[0]
  return (first && MUSCLE_CATEGORY[first]) ?? 'core'
}

export function trackingTypeFor(entry: SeedEntry): TrackingType {
  if (entry.category === 'cardio') return 'distance_time'
  if (entry.category === 'stretching') return 'time'
  if (entry.equipment === 'body only') return 'reps'
  return 'weight_reps'
}

export function loadStyleFor(entry: SeedEntry): LoadStyle | null {
  if (trackingTypeFor(entry) !== 'weight_reps') return null
  if (entry.equipment && entry.equipment in BAR_WEIGHTS) return 'barbell'
  if (entry.equipment && WEIGHTLESS_EQUIPMENT.has(entry.equipment)) return null
  return 'plain'
}

export function barWeightFor(entry: SeedEntry): number | null {
  if (loadStyleFor(entry) !== 'barbell') return null
  return BAR_WEIGHTS[entry.equipment as string] ?? null
}

export function difficultyFor(entry: SeedEntry): 'beginner' | 'intermediate' | 'advanced' | null {
  if (entry.level === 'expert') return 'advanced'
  if (entry.level === 'beginner' || entry.level === 'intermediate') return entry.level
  return null
}
