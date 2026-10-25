import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import NutritionFoodEditor from '../../app/components/nutrition/NutritionFoodEditor.vue'

const catalog = [
  { id: 1, key: 'energy', name: 'Calories', unit: 'kcal', isMacro: true, defaultDirection: 'max' },
  { id: 2, key: 'protein', name: 'Protein', unit: 'g', isMacro: true, defaultDirection: 'min' },
  { id: 3, key: 'carbohydrate', name: 'Carbs', unit: 'g', isMacro: true, defaultDirection: 'max' },
  { id: 4, key: 'fat', name: 'Fat', unit: 'g', isMacro: true, defaultDirection: 'max' },
  { id: 6, key: 'fiber', name: 'Fiber', unit: 'g', isMacro: false, defaultDirection: 'min' }
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
        nutrients: { 3: 10 }
      }
    ])

    wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '4017624010717')
    await vi.waitFor(() => expect(value(wrapper.find('[data-test="food-header-brand"]'))).toBe('Stub Mills'))
    await flushPromises()

    expect(value(wrapper.find('[data-test="food-header-name"]'))).toBe('Imported Bar')
    const [bar, weight] = wrapper.findAll('[data-test="serving-card"]')
    expect(value(bar!.find('[data-test="serving-energy"]'))).toBe('110')
    expect(value(bar!.find('[data-test="serving-protein"]'))).toBe('4')
    expect(value(bar!.find('[data-test="serving-fat"]'))).toBe('6')
    expect(value(weight!.find('[data-test="serving-energy"]'))).toBe('415')
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
        nutrients: { 2: 10 }
      }
    ])

    wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '4017624010717')
    await vi.waitFor(() => expect(value(wrapper.find('[data-test="food-header-brand"]'))).toBe('Stub Mills'))
    await flushPromises()

    expect(wrapper.findAll('[data-test="serving-card"]')).toHaveLength(1)
    expect(value(wrapper.find('[data-test="serving-energy"]'))).toBe('415')
    expect(value(wrapper.find('[data-test="serving-carbohydrate"]'))).toBe('60')
  })
})

describe('NutritionFoodEditor source kcal warning', () => {
  it('warns when the added weight serving carries macros that disagree with the source kcal', async () => {
    registerEndpoint('/api/nutrition/foods/barcode/5000000000011', () => ({
      found: 'off',
      external: {
        ...external,
        barcode: '5000000000011',
        per100g: { energy: 566.7, protein: 5, carbohydrate: 20, fat: 7.9 }
      }
    }))
    const wrapper = await mountEditor([
      {
        id: 50,
        kind: 'named',
        label: 'bar',
        quantity: 1,
        basisGrams: 40,
        hasOwnNutrition: false,
        nutrients: {}
      }
    ])

    wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '5000000000011')
    await vi.waitFor(() => expect(wrapper.find('[data-test="energy-mismatch"]').exists()).toBe(true))
    expect(wrapper.find('[data-test="energy-mismatch"]').text()).toContain(
      'Open Food Facts says 567 kcal per 100 g, the macros give 171. Check the macros against the label.'
    )
  })
})

describe('NutritionFoodEditor barcode resets', () => {
  const namedServing = {
    id: 50,
    kind: 'named',
    label: 'bar',
    quantity: 1,
    basisGrams: 40,
    hasOwnNutrition: false,
    nutrients: {}
  }

  function stubBiscoff() {
    registerEndpoint('/api/nutrition/foods/barcode/5000000000011', () => ({
      found: 'off',
      external: {
        ...external,
        barcode: '5000000000011',
        per100g: { energy: 566.7, protein: 5, carbohydrate: 20, fat: 7.9 }
      }
    }))
  }

  it('adds no weight serving from kcal and a tracked extra without a macro', async () => {
    registerEndpoint('/api/nutrition/foods/barcode/5000000000059', () => ({
      found: 'off',
      external: { ...external, barcode: '5000000000059', per100g: { energy: 200, fiber: 3 } }
    }))
    const wrapper = await mountEditor([namedServing])
    registerEndpoint('/api/nutrition/nutrients/tracked', () => [
      { key: 'energy', name: 'Calories', unit: 'kcal', sortOrder: 0 },
      { key: 'fiber', name: 'Fiber', unit: 'g', sortOrder: 1 }
    ])
    await refreshNuxtData()
    await vi.waitFor(() => expect(wrapper.find('[data-test="serving-fiber"]').exists()).toBe(true))

    wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '5000000000059')
    await vi.waitFor(() => expect(value(wrapper.find('[data-test="food-header-brand"]'))).toBe('Stub Mills'))
    await flushPromises()

    expect(wrapper.findAll('[data-test="serving-card"]')).toHaveLength(1)
    registerEndpoint('/api/nutrition/nutrients/tracked', () => [])
    await refreshNuxtData()
  })

  it('clears the warning and the hints when a rescan finds nothing', async () => {
    stubBiscoff()
    registerEndpoint('/api/nutrition/foods/barcode/5000000000073', () => {
      throw createError({ statusCode: 404, statusMessage: 'Barcode not found', data: { errors: [] } })
    })
    const wrapper = await mountEditor([namedServing])
    const field = wrapper.findComponent({ name: 'NutritionBarcodeField' })
    field.vm.$emit('scanned', '5000000000011')
    await vi.waitFor(() => expect(wrapper.find('[data-test="energy-mismatch"]').exists()).toBe(true))
    expect(wrapper.find('[data-test="barcode-suggestion-name"]').exists()).toBe(true)

    field.vm.$emit('scanned', '5000000000073')
    await vi.waitFor(() => expect(wrapper.find('[data-test="energy-mismatch"]').exists()).toBe(false))
    expect(wrapper.find('[data-test="barcode-suggestion-name"]').exists()).toBe(false)
  })

  it('hides the name hint once the field is edited to match the barcode', async () => {
    stubBiscoff()
    const wrapper = await mountEditor([namedServing])
    wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '5000000000011')
    await vi.waitFor(() => expect(wrapper.find('[data-test="barcode-suggestion-name"]').exists()).toBe(true))

    await wrapper.find('[data-test="food-header-name"]').setValue('stub bar')
    expect(wrapper.find('[data-test="barcode-suggestion-name"]').exists()).toBe(false)
  })

  it('clears the warning and the hints after a successful save', async () => {
    stubBiscoff()
    registerEndpoint('/api/nutrition/foods/5/servings', { method: 'POST', handler: () => ({ id: 51 }) })
    const wrapper = await mountEditor([namedServing])
    wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '5000000000011')
    await vi.waitFor(() => expect(wrapper.find('[data-test="energy-mismatch"]').exists()).toBe(true))
    expect(wrapper.find('[data-test="barcode-suggestion-name"]').exists()).toBe(true)

    await wrapper.find('[data-test="food-save"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[data-test="energy-mismatch"]').exists()).toBe(false))
    expect(wrapper.find('[data-test="barcode-suggestion-name"]').exists()).toBe(false)
  })
})

describe('NutritionFoodEditor stored energy', () => {
  it('stays clean when a stored energy disagrees with the macros', async () => {
    const wrapper = await mountEditor([
      {
        id: 50,
        kind: 'named',
        label: 'bar',
        quantity: 1,
        basisGrams: 40,
        hasOwnNutrition: true,
        nutrients: { 1: 999, 2: 3, 3: 2, 4: 5 }
      }
    ])

    expect(value(wrapper.find('[data-test="serving-energy"]'))).toBe('65')
    expect(wrapper.find('[data-test="food-save"]').attributes('disabled')).toBeDefined()
  })
})

describe('NutritionFoodEditor barcode name and brand hint', () => {
  const peanuts = {
    ...external,
    externalId: '5000000000042',
    barcode: '5000000000042',
    name: 'Dry Roasted Peanuts Seasoned with Sea Salt',
    brand: 'Great Value',
    per100g: null
  }

  async function scanPeanuts(name: string, brand: string) {
    registerEndpoint('/api/nutrition/nutrients', () => catalog)
    registerEndpoint('/api/nutrition/nutrients/tracked', () => [])
    registerEndpoint('/api/nutrition/foods/5', () => ({ ...food([]), name, brand }))
    registerEndpoint('/api/nutrition/foods/barcode/5000000000042', () => ({ found: 'off', external: peanuts }))
    const wrapper = await mountSuspended(NutritionFoodEditor, { props: { foodId: 5 } })
    await vi.waitFor(() => expect(wrapper.find('[data-test="food-header-name"]').exists()).toBe(true))
    await flushPromises()
    wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '5000000000042')
    await vi.waitFor(() => expect(wrapper.find('[data-test="barcode-suggestion-name"]').exists()).toBe(true))
    return wrapper
  }

  it('offers the barcode name when it differs, and replaces the field on tap', async () => {
    const wrapper = await scanPeanuts('Dry roasted unsalted peanuts', 'Great value')

    const hint = wrapper.find('[data-test="barcode-suggestion-name"]')
    expect(hint.text()).toContain('Barcode says: Dry Roasted Peanuts Seasoned with Sea Salt')
    expect(value(wrapper.find('[data-test="food-header-name"]'))).toBe('Dry roasted unsalted peanuts')
    expect(wrapper.find('[data-test="barcode-suggestion-brand"]').exists()).toBe(false)

    await hint.find('button').trigger('click')
    expect(value(wrapper.find('[data-test="food-header-name"]'))).toBe('Dry Roasted Peanuts Seasoned with Sea Salt')
    expect(wrapper.find('[data-test="barcode-suggestion-name"]').exists()).toBe(false)
  })

  it('offers the brand when it differs', async () => {
    const wrapper = await scanPeanuts('Dry roasted unsalted peanuts', 'Kirkland')

    const hint = wrapper.find('[data-test="barcode-suggestion-brand"]')
    expect(hint.text()).toContain('Barcode says: Great Value')
    await hint.find('button').trigger('click')
    expect(value(wrapper.find('[data-test="food-header-brand"]'))).toBe('Great Value')
    expect(wrapper.find('[data-test="barcode-suggestion-brand"]').exists()).toBe(false)
  })
})
