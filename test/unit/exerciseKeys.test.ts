import { describe, expect, it } from 'vitest'
import { exerciseListKey, exerciseListQuery } from '../../shared/utils/exerciseKeys'

describe('exerciseListKey', () => {
  it('is stable regardless of filter order', () => {
    expect(exerciseListKey({ q: 'bench', muscles: ['lats', 'chest'] })).toBe(
      exerciseListKey({ muscles: ['chest', 'lats'], q: 'bench' })
    )
  })

  it('separates different filters', () => {
    expect(exerciseListKey({ q: 'bench' })).not.toBe(exerciseListKey({ q: 'squat' }))
  })

  it('separates page sizes of the same filter', () => {
    expect(exerciseListKey({ q: 'bench', limit: 20 })).not.toBe(exerciseListKey({ q: 'bench', limit: 40 }))
  })

  it('starts with the list prefix so prefix invalidation catches it', () => {
    expect(exerciseListKey({ q: 'bench' }).startsWith('workouts:exercises:')).toBe(true)
  })
})

describe('exerciseListQuery', () => {
  it('emits only the set filters in a fixed order', () => {
    expect(exerciseListQuery({ includeHidden: true, q: ' dum press ', muscles: ['lats', 'chest'] })).toBe(
      'q=dum+press&muscles=chest%2Clats&includeHidden=1'
    )
  })
  it('omits false flags, empty text and null difficulty', () => {
    expect(exerciseListQuery({ q: '', favorites: false, includeHidden: false, difficulty: null })).toBe('')
  })
  it('puts the page size last', () => {
    expect(exerciseListQuery({ limit: 40, q: 'row' })).toBe('q=row&limit=40')
  })
  it('carries the category and difficulty', () => {
    expect(exerciseListQuery({ categoryId: 3, difficulty: 'beginner', favorites: true })).toBe(
      'categoryId=3&difficulty=beginner&favorites=1'
    )
  })
})
