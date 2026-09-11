import { describe, expect, it } from 'vitest'
import type { PickedFood } from '../../app/types/nutrition'

const picked = { foodId: 1, name: 'Oats', brand: null, quantity: 50, unitLabel: 'g', food: { id: 1, servings: [] } } as unknown as PickedFood

describe('useAddTray', () => {
  it('builds one mixed entry array in food, recipe, meal order', async () => {
    const { useAddTray } = await import('../../app/composables/useAddTray')
    const tray = useAddTray()
    tray.state.foods = [picked]
    tray.toggleRecipe({ id: 7, name: 'Chili', servingName: 'bowl' }, true)
    tray.setRecipeServings(7, 1.5)
    tray.toggleMeal({ id: 9, name: 'Breakfast' }, true)

    expect(tray.count.value).toBe(3)
    expect(tray.ready.value).toBe(true)
    expect(tray.toEntryInputs(4)).toEqual([
      { entryType: 'food', containerId: 4, foodId: 1, quantity: 50, unitLabel: 'g' },
      { entryType: 'recipe', containerId: 4, recipeId: 7, quantity: 1.5, unitLabel: 'bowl' },
      { entryType: 'food', containerId: 4, savedMealId: 9, quantity: 1, unitLabel: 'meal' }
    ])
  })

  it('is not ready with a non-positive amount, and remove/clear empty it', async () => {
    const { useAddTray } = await import('../../app/composables/useAddTray')
    const tray = useAddTray()
    tray.toggleRecipe({ id: 7, name: 'Chili', servingName: 'bowl' }, true)
    tray.setRecipeServings(7, 0)
    expect(tray.ready.value).toBe(false)
    tray.remove('recipe', 7)
    expect(tray.count.value).toBe(0)
    tray.toggleMeal({ id: 9, name: 'Breakfast' }, true)
    tray.toggleMeal({ id: 9, name: 'Breakfast' }, true)
    expect(tray.state.meals).toHaveLength(1)
    tray.clear()
    expect(tray.count.value).toBe(0)
  })
})
