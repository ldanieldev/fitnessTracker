import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { PickedFood } from '../../app/types/nutrition'

const idToKey = ref(new Map([[1, 'energy'], [2, 'protein'], [3, 'carbohydrate'], [4, 'fat']]))

// Nuxt's real useState is only available under the nuxt vitest project; this mimics its per-key ref sharing for the node project.
const stateStore = new Map<string, ReturnType<typeof ref>>()
beforeEach(() => {
  stateStore.clear()
  vi.stubGlobal('useState', (key: string, init: () => unknown) => {
    if (!stateStore.has(key)) stateStore.set(key, ref(init()))
    return stateStore.get(key)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const picked = {
  foodId: 1,
  name: 'Oats',
  brand: null,
  quantity: 100,
  unitLabel: 'g',
  food: {
    id: 1,
    servings: [{ id: 10, kind: 'weight', label: 'g', quantity: 100, basisGrams: 100, hasOwnNutrition: true, nutrients: { 1: 380, 2: 13, 3: 68, 4: 7 } }]
  }
} as unknown as PickedFood

describe('useAddTray', () => {
  it('builds one mixed entry array in food, recipe, meal order', async () => {
    const { useAddTray } = await import('../../app/composables/useAddTray')
    const tray = useAddTray(idToKey, '2026-09-01')
    tray.state.foods = [picked]
    tray.toggleRecipe({ id: 7, name: 'Chili', servingName: 'bowl', perServing: { energy: 450, protein: 30 } }, true)
    tray.setRecipeServings(7, 1.5)
    tray.toggleMeal({ id: 9, name: 'Breakfast', total: { energy: 200, protein: 10 } }, true)

    expect(tray.count.value).toBe(3)
    expect(tray.ready.value).toBe(true)
    expect(tray.toEntryInputs(4)).toEqual([
      { entryType: 'food', containerId: 4, foodId: 1, quantity: 100, unitLabel: 'g' },
      { entryType: 'recipe', containerId: 4, recipeId: 7, quantity: 1.5, unitLabel: 'bowl' },
      { entryType: 'food', containerId: 4, savedMealId: 9, quantity: 1, unitLabel: 'meal' }
    ])
  })

  it('sums totals from a food resolved by label, a recipe scaled by servings, and a meal', async () => {
    const { useAddTray } = await import('../../app/composables/useAddTray')
    const tray = useAddTray(idToKey, '2026-09-01')
    tray.state.foods = [picked]
    tray.toggleRecipe({ id: 7, name: 'Chili', servingName: 'bowl', perServing: { energy: 450, protein: 30, carbohydrate: 40, fat: 15 } }, true)
    tray.setRecipeServings(7, 2)
    tray.toggleMeal({ id: 9, name: 'Breakfast', total: { energy: 200, protein: 10, carbohydrate: 20, fat: 5 } }, true)

    expect(tray.totals.value).toEqual({ energy: 1480, protein: 83, carbohydrate: 168, fat: 42 })
  })

  it('is not ready with a non-positive amount, and remove/clear empty it', async () => {
    const { useAddTray } = await import('../../app/composables/useAddTray')
    const tray = useAddTray(idToKey, '2026-09-01')
    tray.toggleRecipe({ id: 7, name: 'Chili', servingName: 'bowl', perServing: {} }, true)
    tray.setRecipeServings(7, 0)
    expect(tray.ready.value).toBe(false)
    tray.remove('recipe', 7)
    expect(tray.count.value).toBe(0)
    tray.toggleMeal({ id: 9, name: 'Breakfast', total: {} }, true)
    tray.toggleMeal({ id: 9, name: 'Breakfast', total: {} }, true)
    expect(tray.state.meals).toHaveLength(1)
    tray.clear()
    expect(tray.count.value).toBe(0)
  })

  it('persists state across two instances for the same date, isolated from a different date', async () => {
    const { useAddTray } = await import('../../app/composables/useAddTray')
    const first = useAddTray(idToKey, '2026-09-01')
    first.state.foods = [picked]

    const second = useAddTray(idToKey, '2026-09-01')
    expect(second.state.foods).toEqual([picked])
    expect(second.count.value).toBe(1)

    const otherDate = useAddTray(idToKey, '2026-09-02')
    expect(otherDate.state.foods).toEqual([])
    expect(otherDate.count.value).toBe(0)
  })
})
