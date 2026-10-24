import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import NutritionFoodEditor from '../../app/components/nutrition/NutritionFoodEditor.vue'

const catalog = [
  { id: 1, key: 'energy', name: 'Calories', unit: 'kcal', isMacro: true, defaultDirection: 'max' },
  { id: 2, key: 'protein', name: 'Protein', unit: 'g', isMacro: true, defaultDirection: 'min' },
  { id: 3, key: 'carbohydrate', name: 'Carbs', unit: 'g', isMacro: true, defaultDirection: 'max' },
  { id: 4, key: 'fat', name: 'Fat', unit: 'g', isMacro: true, defaultDirection: 'max' }
]

function food(servings: unknown[]) {
  return {
    id: 5,
    name: 'Imported Bar',
    brand: null,
    barcode: null,
    createdByUserId: 1,
    source: null,
    defaultServingId: 50,
    energyDensity: null,
    servings
  }
}

const external = {
  source: 'off',
  externalId: '4017624010717',
  name: 'Stub Bar',
  brand: 'Stub Mills',
  barcode: '4017624010717',
  per100g: { energy: 400, protein: 10, carbohydrate: 60, fat: 15 },
  servingGrams: null,
  servingLabel: null,
  attribution: null
}

async function mountEditor(servings: unknown[]) {
  registerEndpoint('/api/nutrition/nutrients', () => catalog)
  registerEndpoint('/api/nutrition/nutrients/tracked', () => [])
  registerEndpoint('/api/nutrition/foods/5', () => food(servings))
  registerEndpoint('/api/nutrition/foods/barcode/4017624010717', () => ({ found: 'off', external }))
  const wrapper = await mountSuspended(NutritionFoodEditor, { props: { foodId: 5 } })
  await vi.waitFor(() => expect(wrapper.find('[data-test="food-header-name"]').exists()).toBe(true))
  await flushPromises()
  return wrapper
}

const value = (el: { element: Element }) => (el.element as HTMLInputElement).value

describe('NutritionFoodEditor barcode prefill', () => {
  it('fills only the blank brand and nutrients of a gram-weighted serving, unsaved', async () => {
    const wrapper = await mountEditor([
      {
        id: 50,
        kind: 'named',
        label: 'bar',
        quantity: 1,
        basisGrams: 40,
        hasOwnNutrition: true,
        nutrients: { 1: 170 }
      }
    ])

    wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '4017624010717')
    await vi.waitFor(() => expect(value(wrapper.find('[data-test="food-header-brand"]'))).toBe('Stub Mills'))
    await flushPromises()

    expect(value(wrapper.find('[data-test="food-header-name"]'))).toBe('Imported Bar')
    const [bar, weight] = wrapper.findAll('[data-test="serving-card"]')
    expect(value(bar!.find('[data-test="serving-energy"]'))).toBe('170')
    expect(value(bar!.find('[data-test="serving-protein"]'))).toBe('4')
    expect(value(bar!.find('[data-test="serving-fat"]'))).toBe('6')
    expect(value(weight!.find('[data-test="serving-energy"]'))).toBe('400')
    expect(wrapper.find('[data-test="food-save"]').attributes('disabled')).toBeUndefined()
  })

  it('adds no weight serving when the food already has one', async () => {
    const wrapper = await mountEditor([
      {
        id: 50,
        kind: 'weight',
        label: 'g',
        quantity: 100,
        basisGrams: 100,
        hasOwnNutrition: true,
        nutrients: { 1: 390 }
      }
    ])

    wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '4017624010717')
    await vi.waitFor(() => expect(value(wrapper.find('[data-test="food-header-brand"]'))).toBe('Stub Mills'))
    await flushPromises()

    expect(wrapper.findAll('[data-test="serving-card"]')).toHaveLength(1)
    expect(value(wrapper.find('[data-test="serving-energy"]'))).toBe('390')
    expect(value(wrapper.find('[data-test="serving-carbohydrate"]'))).toBe('60')
  })
})
