import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NutritionContainerCard from '../../app/components/nutrition/NutritionContainerCard.vue'

const container = {
  id: 7, name: 'Meal 1', sortOrder: 0, isArchived: false,
  entries: [{ id: 1, containerId: 7, entryType: 'food' as const, foodId: 1, foodServingId: 10, recipeId: null, quantity: 3, unitLabel: 'egg', gramsResolved: null, description: 'Large Egg', brandSnapshot: null, loggedAt: '2026-09-10T07:40:00.000Z', notes: null, ingredientSnapshot: null, nutrients: { energy: 207, protein: 18, fat: 15 } }],
  subtotals: { energy: 207, protein: 18, carbohydrate: 0, fat: 15, fiber: 0 }
}

describe('NutritionContainerCard', () => {
  it('puts the add button in the header and lays subtotals out in one row', async () => {
    const wrapper = await mountSuspended(NutritionContainerCard, {
      props: { container, date: '2026-09-10', nutrients: [{ key: 'energy', name: 'Calories', unit: 'kcal' }, { key: 'protein', name: 'Protein', unit: 'g' }, { key: 'carbohydrate', name: 'Carbs', unit: 'g' }, { key: 'fat', name: 'Fat', unit: 'g' }, { key: 'fiber', name: 'Fiber', unit: 'g' }] }
    })
    const add = wrapper.find('[data-test="container-add"]')
    expect(add.attributes('href')).toBe('/diary/2026-09-10/add?containerId=7')
    expect(wrapper.find('[data-test="container-header"]').find('[data-test="container-add"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-test="subtotal-cell"]')).toHaveLength(5)
    expect(wrapper.find('[data-test="subtotal-protein"]').text()).toBe('18')
    expect(wrapper.find('[data-test="entry-row"] [data-test="entry-energy"]').text()).toContain('207')
  })
})
