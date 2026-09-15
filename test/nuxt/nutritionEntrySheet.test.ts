import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, DOMWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import NutritionEntrySheet from '../../app/components/nutrition/NutritionEntrySheet.vue'
import type { DiaryEntry } from '../../app/composables/useDiaryDay'

const containers = [{ id: 1, name: 'Meal 1' }, { id: 2, name: 'Meal 2' }]

function entry(over: Partial<DiaryEntry>): DiaryEntry {
  return {
    id: 5, containerId: 1, entryType: 'food', foodId: 3, foodServingId: 30, recipeId: null, quantity: 100, unitLabel: 'g',
    gramsResolved: 100, description: 'Bread', brandSnapshot: null, loggedAt: new Date(2026, 8, 2, 8, 0).toISOString(),
    notes: null, ingredientSnapshot: null, nutrients: { energy: 260 }, ...over
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

async function mountSheet(value: DiaryEntry) {
  const wrapper = await mountSuspended(NutritionEntrySheet, { attachTo: document.body, props: { open: true, entry: value, containers } })
  await flushPromises()
  return { wrapper, body: new DOMWrapper(document.body) }
}

describe('NutritionEntrySheet', () => {
  it('shows the unit picker for a food entry and emits only the changed fields', async () => {
    registerEndpoint('/api/nutrition/nutrients', () => [{ id: 1, key: 'energy', name: 'Calories', unit: 'kcal', isMacro: true, defaultDirection: 'max' }])
    registerEndpoint('/api/nutrition/foods/3', () => ({
      id: 3, name: 'Bread', brand: null, barcode: null, createdByUserId: 1, source: null, defaultServingId: 30, energyDensity: null,
      servings: [{ id: 30, kind: 'weight', label: 'g', quantity: 100, basisGrams: 100, hasOwnNutrition: true, nutrients: { 1: 260 } }]
    }))
    const { wrapper, body } = await mountSheet(entry({}))
    expect(body.find('[data-test="entry-sheet-unit"]').exists()).toBe(true)

    await body.find('[data-test="entry-sheet-notes"]').setValue('crusty')
    await body.find('[data-test="entry-save"]').trigger('click')
    expect(wrapper.emitted('save')?.[0]).toEqual([5, { notes: 'crusty' }])
    wrapper.unmount()
  })

  it('hides the unit picker for recipe and quick-add entries', async () => {
    for (const entryType of ['recipe', 'quick_add'] as const) {
      const { wrapper, body } = await mountSheet(entry({ entryType, foodId: null, unitLabel: 'serving', quantity: 1 }))
      expect(body.find('[data-test="entry-sheet-quantity"]').exists()).toBe(true)
      expect(body.find('[data-test="entry-sheet-unit"]').exists()).toBe(false)
      wrapper.unmount()
      document.body.innerHTML = ''
    }
  })

  it('disables the unit picker when the food is gone', async () => {
    registerEndpoint('/api/nutrition/foods/4', () => {
      throw createError({ statusCode: 404, statusMessage: 'Food not found' })
    })
    const { wrapper, body } = await mountSheet(entry({ foodId: 4 }))
    expect(body.find('[data-test="entry-sheet-unit"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
