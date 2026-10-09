import { describe, expect, it } from 'vitest'
import {
  EXERCISE_SEARCH_INDEX_SETTINGS,
  exerciseToSearchDocument,
  exerciseVisibilityFilter
} from '../../server/utils/workouts/searchDocuments'

describe('exercise search documents', () => {
  it('indexes the name and flags catalogue rows', () => {
    const doc = exerciseToSearchDocument({ id: 7, name: 'Barbell Bench Press', createdByUserId: null })
    expect(doc).toEqual({ id: 7, name: 'Barbell Bench Press', is_catalog: true, owner_id: null })
  })

  it('carries the owner for a user exercise', () => {
    expect(exerciseToSearchDocument({ id: 9, name: 'Board Press', createdByUserId: 3 })).toMatchObject({
      is_catalog: false,
      owner_id: 3
    })
  })

  it('filters to catalogue rows or the caller’s own', () => {
    expect(exerciseVisibilityFilter(3)).toBe('is_catalog = true OR owner_id = 3')
  })

  it('only searches the name and only filters on visibility', () => {
    expect(EXERCISE_SEARCH_INDEX_SETTINGS.searchableAttributes).toEqual(['name'])
    expect(EXERCISE_SEARCH_INDEX_SETTINGS.filterableAttributes).toEqual(['is_catalog', 'owner_id'])
  })
})
