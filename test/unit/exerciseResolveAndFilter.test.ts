import { describe, expect, it } from 'vitest'
import { resolveAndFilter } from '../../shared/utils/exerciseList'
import { effectiveLoadStyle } from '../../shared/utils/exerciseResolve'
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
  plateSizes: null,
  notes: null,
  link: null,
  defaultGraph: null,
  favorite: false,
  hiddenAt: null
}

describe('resolveAndFilter category resolution', () => {
  it('uses the pref category when it resolves and marks it overridden', () => {
    const prefs = new Map([[row.id, prefWithCategory]])
    const categoriesById = new Map([
      [catalogueCategory.id, catalogueCategory],
      [prefCategory.id, prefCategory]
    ])
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

const pref = (over: Partial<ExercisePrefRow> = {}): ExercisePrefRow => ({
  ...prefWithCategory,
  categoryId: null,
  ...over
})

describe('effectiveLoadStyle', () => {
  it('inherits the catalogue load style and lets the pref override it', () => {
    expect(effectiveLoadStyle(row, null)).toBe('barbell')
    expect(effectiveLoadStyle(row, pref({ loadStyle: 'plain' }))).toBe('plain')
  })

  it('is null under a non-weight tracking type', () => {
    expect(effectiveLoadStyle(row, pref({ trackingType: 'reps' }))).toBeNull()
  })
})

describe('resolveAndFilter plate sizes', () => {
  it('returns a plates override for a barbell exercise and hides it otherwise', () => {
    const categoriesById = new Map([[catalogueCategory.id, catalogueCategory]])
    const barbell = resolveAndFilter([row], new Map([[row.id, pref({ plateSizes: ['55', '45'] })]]), categoriesById, {})
    expect(barbell[0]!.plateSizes).toEqual([55, 45])
    const plain = resolveAndFilter(
      [row],
      new Map([[row.id, pref({ loadStyle: 'plain', plateSizes: ['55', '45'] })]]),
      categoriesById,
      {}
    )
    expect(plain[0]!.plateSizes).toBeNull()
  })
})
