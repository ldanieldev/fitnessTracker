import { createError } from 'h3'
import type {
  Exercise,
  ExerciseCategory,
  ExerciseListFilters,
  ExercisePrefRow,
  ExerciseRow
} from '../types/workout'
import { resolveExercise } from './exerciseResolve'
import { matchesTerms, rankExercise } from './exerciseSearch'

function resolveCategoryFor(
  row: ExerciseRow,
  pref: ExercisePrefRow | null,
  categoriesById: Map<number, ExerciseCategory>
): { category: ExerciseCategory, pref: ExercisePrefRow | null } {
  const prefCategory = pref?.categoryId != null ? categoriesById.get(pref.categoryId) : undefined
  if (prefCategory) return { category: prefCategory, pref }

  const catalogueCategory = categoriesById.get(row.categoryId)
  if (!catalogueCategory) throw createError({ statusCode: 500, statusMessage: 'Exercise category missing' })
  // Pref points at a category the user can no longer see (soft-deleted) — fall back instead of 500ing the request.
  return { category: catalogueCategory, pref: pref ? { ...pref, categoryId: null } : null }
}

// 876 catalogue rows is small enough that filtering after resolution is honest and keeps one code path.
export function resolveAndFilter(
  rows: ExerciseRow[],
  prefs: Map<number, ExercisePrefRow>,
  categoriesById: Map<number, ExerciseCategory>,
  filters: ExerciseListFilters
): Exercise[] {
  const resolved = rows.map((row) => {
    const pref = prefs.get(row.id) ?? null
    const { category, pref: effectivePref } = resolveCategoryFor(row, pref, categoriesById)
    return resolveExercise(row, effectivePref, category)
  })

  const filtered = resolved.filter((ex) => {
    if (filters.q && !matchesTerms(ex.name, filters.q)) return false
    if (filters.categoryId !== undefined && ex.category.id !== filters.categoryId) return false
    if (filters.muscles?.length) {
      const hasMuscle = filters.muscles.some((m) => ex.primaryMuscles.includes(m) || ex.secondaryMuscles.includes(m))
      if (!hasMuscle) return false
    }
    if (filters.equipment?.length && !filters.equipment.some((e) => ex.equipment.includes(e))) return false
    if (filters.difficulty && ex.difficulty !== filters.difficulty) return false
    if (filters.favorites && !ex.favorite) return false
    if (!filters.includeHidden && ex.hidden) return false
    return true
  })

  const q = filters.q ?? ''
  return filtered.sort((a, b) => {
    return rankExercise(a.name, q, a.favorite) - rankExercise(b.name, q, b.favorite) || a.name.localeCompare(b.name)
  })
}
