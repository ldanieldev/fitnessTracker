import type { ExerciseListFilters } from '../types/workout'

export const EXERCISE_KEYS = {
  reference: 'workouts:reference',
  categories: 'workouts:categories',
  categoriesAll: 'workouts:categories:all',
  variations: 'workouts:variations',
  list: 'workouts:exercises:',
  detail: (id: number) => `workouts:exercise:${id}`
} as const

interface NormalizedExerciseFilters {
  q?: string
  categoryId?: number
  muscles?: string[]
  equipment?: string[]
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  favorites?: true
  includeHidden?: true
  limit?: number
}

const FILTER_ORDER: (keyof NormalizedExerciseFilters)[] = [
  'q',
  'categoryId',
  'muscles',
  'equipment',
  'difficulty',
  'favorites',
  'includeHidden',
  'limit'
]

function normalizeExerciseFilters(filters: ExerciseListFilters): NormalizedExerciseFilters {
  const out: NormalizedExerciseFilters = {}
  const q = filters.q?.trim()
  if (q) out.q = q
  if (filters.categoryId !== undefined) out.categoryId = filters.categoryId
  if (filters.muscles?.length) out.muscles = [...filters.muscles].sort()
  if (filters.equipment?.length) out.equipment = [...filters.equipment].sort()
  if (filters.difficulty) out.difficulty = filters.difficulty
  if (filters.favorites) out.favorites = true
  if (filters.includeHidden) out.includeHidden = true
  if (filters.limit !== undefined) out.limit = filters.limit
  return out
}

export function exerciseListKey(filters: ExerciseListFilters = {}): string {
  const normalized = normalizeExerciseFilters(filters)
  return EXERCISE_KEYS.list + JSON.stringify(normalized, Object.keys(normalized).sort())
}

export function exerciseListQuery(filters: ExerciseListFilters): string {
  const normalized = normalizeExerciseFilters(filters)
  const params = new URLSearchParams()
  for (const key of FILTER_ORDER) {
    const value = normalized[key]
    if (value === undefined) continue
    if (Array.isArray(value)) params.set(key, value.join(','))
    else if (value === true) params.set(key, '1')
    else params.set(key, String(value))
  }
  return params.toString()
}
