import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseCategory, ExerciseRow } from '../../shared/types/workout'

const { rankSpy } = vi.hoisted(() => ({ rankSpy: vi.fn() }))
vi.mock('../../shared/utils/exerciseSearch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/utils/exerciseSearch')>()
  rankSpy.mockImplementation(actual.rankExercise)
  return { ...actual, rankExercise: rankSpy }
})
const { resolveAndFilter } = await import('../../shared/utils/exerciseList')

const category: ExerciseCategory = {
  id: 1, key: 'chest', name: 'Chest', color: 'rose', sortOrder: 0, shared: true, hidden: false
}
const rowNamed = (id: number, name: string): ExerciseRow => ({
  id, name, categoryId: 1, trackingType: 'reps', loadStyle: null, barWeight: null, difficulty: null, images: [],
  instructions: [], createdByUserId: null, equipment: [], primaryMuscles: [], secondaryMuscles: []
})

describe('resolveAndFilter ranking', () => {
  beforeEach(() => {
    rankSpy.mockClear()
  })

  it('ranks each exercise once, not once per comparison', () => {
    const rows = Array.from({ length: 40 }, (_, i) => rowNamed(i + 1, `Press ${String(40 - i).padStart(2, '0')}`))
    const out = resolveAndFilter(rows, new Map(), new Map([[1, category]]), { q: 'press' })
    expect(rankSpy).toHaveBeenCalledTimes(40)
    expect(out.map((e) => e.name).slice(0, 2)).toEqual(['Press 01', 'Press 02'])
  })
})
