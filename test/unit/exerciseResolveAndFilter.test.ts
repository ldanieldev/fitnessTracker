import { describe, expect, it } from 'vitest'
import { resolveAndFilter } from '../../shared/utils/exerciseList'
import type { ExerciseCategory, ExercisePrefRow, ExerciseRow } from '../../shared/types/workout'

const catalogueCategory: ExerciseCategory = {
  id: 1,
  key: 'chest',
  name: 'Chest',
  color: 'rose',
  sortOrder: 0,
  shared: true,
  hidden: false
}
const prefCategory: ExerciseCategory = {
  id: 2,
  key: 'back',
  name: 'Back',
  color: 'blue',
  sortOrder: 1,
  shared: true,
  hidden: false
}

const row: ExerciseRow = {
  id: 7,
  name: 'Barbell Bench Press',
  categoryId: 1,
  trackingType: 'weight_reps',
  loadStyle: 'barbell',
  barWeight: '45',
  difficulty: 'beginner',
  images: [],
  instructions: [],
  createdByUserId: null,
  equipment: ['barbell'],
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps']
}

const prefWithCategory: ExercisePrefRow = {
  barWeight: null,
  trackingType: null,
  loadStyle: null,
  categoryId: 2,
  weightIncrement: null,
  restSeconds: null,
  notes: null,
  link: null,
  favorite: false,
  hiddenAt: null
}

describe('resolveAndFilter category resolution', () => {
  it('uses the pref category when it resolves and marks it overridden', () => {
    const prefs = new Map([[row.id, prefWithCategory]])
    const categoriesById = new Map([[catalogueCategory.id, catalogueCategory], [prefCategory.id, prefCategory]])
    const [exercise] = resolveAndFilter([row], prefs, categoriesById, {})
    expect(exercise!.category.key).toBe('back')
    expect(exercise!.overridden.category).toBe(true)
  })

  it('falls back to the catalogue category when the pref points at one that is no longer visible', () => {
    const prefs = new Map([[row.id, prefWithCategory]])
    const categoriesById = new Map([[catalogueCategory.id, catalogueCategory]])
    const [exercise] = resolveAndFilter([row], prefs, categoriesById, {})
    expect(exercise!.category.key).toBe('chest')
    expect(exercise!.overridden.category).toBe(false)
  })

  it('throws when even the catalogue category is missing', () => {
    const categoriesById = new Map<number, ExerciseCategory>()
    expect(() => resolveAndFilter([row], new Map(), categoriesById, {})).toThrow()
  })
})
