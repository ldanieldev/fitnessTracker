import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NutritionEntryRow from '../../app/components/nutrition/NutritionEntryRow.vue'
import type { DiaryEntry } from '../../app/composables/useDiaryDay'

function entry(over: Partial<DiaryEntry>): DiaryEntry {
  return {
    id: 1, containerId: 1, entryType: 'food', foodId: 3, foodServingId: 30, recipeId: null, quantity: 100, unitLabel: 'g',
    gramsResolved: 100, description: 'Bread', brandSnapshot: null, loggedAt: new Date(2026, 8, 2, 8, 0).toISOString(),
    notes: null, ingredientSnapshot: null, nutrients: { energy: 260 }, ...over
  }
}

describe('NutritionEntryRow', () => {
  it('renders a recipe entry\'s ingredients unconditionally, with one chevron', async () => {
    const wrapper = await mountSuspended(NutritionEntryRow, {
      props: {
        entry: entry({
          entryType: 'recipe',
          recipeId: 7,
          ingredientSnapshot: [
            { foodId: 1, name: 'Oats', quantity: 50, unitLabel: 'g', gramsResolved: 50, nutrients: { energy: 190 } },
            { foodId: 2, name: 'Milk', quantity: 200, unitLabel: 'ml', gramsResolved: 200, nutrients: { energy: 100 } }
          ]
        })
      }
    })
    const lines = wrapper.findAll('[data-test="entry-ingredients"] li')
    expect(lines).toHaveLength(2)
    expect(lines[0]!.text()).toBe('Oats · 50 g')
    expect(lines[1]!.text()).toBe('Milk · 200 ml')
    expect(wrapper.findAll('[class*="chevron-right"]')).toHaveLength(1)
  })

  it('renders no ingredient list for a food entry', async () => {
    const wrapper = await mountSuspended(NutritionEntryRow, { props: { entry: entry({}) } })
    expect(wrapper.find('[data-test="entry-ingredients"]').exists()).toBe(false)
  })
})
