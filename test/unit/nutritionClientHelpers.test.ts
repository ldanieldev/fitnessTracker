import { describe, expect, it } from 'vitest'
import type { FoodForResolve } from '../../shared/types/nutrition'
import type { DiaryEntry } from '../../app/composables/useDiaryDay'

const food: FoodForResolve = {
  id: 1,
  servings: [
    { id: 10, kind: 'weight', label: 'g', quantity: 100, basisGrams: 100, hasOwnNutrition: true, nutrients: { 1: 200 } },
    { id: 11, kind: 'named', label: 'slice', quantity: 1, basisGrams: null, hasOwnNutrition: true, nutrients: { 1: 90 } }
  ]
}

function entry(over: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: 5, containerId: 1, entryType: 'food', foodId: 1, foodServingId: 10, recipeId: null,
    quantity: 150, unitLabel: 'g', gramsResolved: 150, description: 'Bread', brandSnapshot: null,
    loggedAt: new Date(2026, 8, 10, 7, 40).toISOString(), notes: null, ingredientSnapshot: null,
    nutrients: { energy: 300, protein: 12 }, ...over
  }
}

describe('resolveByLabel', () => {
  it('resolves mass and named labels and rejects unknown labels and non-positive quantities', async () => {
    const { resolveByLabel } = await import('../../app/utils/nutrition/resolveByLabel')
    expect(resolveByLabel(food, 'g', 50)![1]).toBeCloseTo(100, 10)
    expect(resolveByLabel(food, 'oz', 1)![1]).toBeCloseTo(56.69904625, 6)
    expect(resolveByLabel(food, 'slice', 2)![1]).toBeCloseTo(180, 10)
    expect(resolveByLabel(food, 'cup', 1)).toBeNull()
    expect(resolveByLabel(food, 'g', 0)).toBeNull()
  })
})

describe('entryEdit', () => {
  it('merges a new time onto the same local calendar date', async () => {
    const { mergeTime, timeOf } = await import('../../app/utils/nutrition/entryEdit')
    const original = new Date(2026, 8, 10, 7, 40).toISOString()
    const merged = new Date(mergeTime(original, '12:05'))
    expect([merged.getFullYear(), merged.getMonth(), merged.getDate(), merged.getHours(), merged.getMinutes()]).toEqual([2026, 8, 10, 12, 5])
    expect(timeOf(original)).toBe('07:40')
  })

  it('patches only changed fields and never sends a unit for non-food entries', async () => {
    const { draftFromEntry, entryPatch } = await import('../../app/utils/nutrition/entryEdit')
    const food = entry()
    expect(entryPatch(food, draftFromEntry(food))).toEqual({})
    expect(entryPatch(food, { ...draftFromEntry(food), quantity: 200, unitLabel: 'slice', notes: '  ' })).toEqual({ quantity: 200, unitLabel: 'slice' })

    const recipe = entry({ entryType: 'recipe', unitLabel: 'bowl', quantity: 1, notes: 'old' })
    const patch = entryPatch(recipe, { ...draftFromEntry(recipe), unitLabel: 'plate', containerId: 2, notes: '', time: '08:00' })
    expect(patch).toMatchObject({ containerId: 2, notes: null })
    expect(patch).not.toHaveProperty('unitLabel')
    expect(new Date(patch.loggedAt!).getHours()).toBe(8)

    const malformed = entryPatch(food, { ...draftFromEntry(food), time: '' })
    expect(malformed).toEqual({})
  })

  it('scales a snapshot by the quantity ratio', async () => {
    const { scaledPreview } = await import('../../app/utils/nutrition/entryEdit')
    expect(scaledPreview({ energy: 300, protein: 12 }, 150, 75)).toEqual({ energy: 150, protein: 6 })
    expect(scaledPreview({ energy: 300 }, 150, 0)).toEqual({ energy: 0 })
  })
})

describe('formatDayTitle', () => {
  it('formats a diary date as a short weekday title', async () => {
    const { formatDayTitle } = await import('../../app/utils/nutrition/dayTitle')
    expect(formatDayTitle('2026-09-10')).toBe('Thu, Sep 10')
  })
})

describe('nutritionKeyed', () => {
  it('keys by id and sums', async () => {
    const { keyNutrients, sumKeyed } = await import('../../shared/utils/nutritionKeyed')
    expect(keyNutrients({ 1: 2 }, new Map([[1, 'energy']]))).toEqual({ energy: 2 })
    expect(sumKeyed([{ nutrients: { energy: 1 } }, { nutrients: { energy: 2 } }])).toEqual({ energy: 3 })
  })
})
