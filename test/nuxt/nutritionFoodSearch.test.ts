import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { ComponentPublicInstance } from 'vue'
import { UCheckbox } from '#components'
import NutritionFoodSearch from '../../app/components/nutrition/NutritionFoodSearch.vue'
import NutritionAmountInput from '../../app/components/nutrition/NutritionAmountInput.vue'

// Nuxt UI's generic component type hits the FunctionalComponent findAllComponents overload (DOMWrapper); cast to get a VueWrapper.
const CheckboxCtor = UCheckbox as unknown as new () => ComponentPublicInstance

const recentHits = [
  { id: 1, name: 'Chicken Breast', brand: 'Acme', isFavorite: false, logCount: 3, energyDensity: null },
  { id: 2, name: 'Brown Rice', brand: null, isFavorite: true, logCount: 5, energyDensity: null },
  { id: 3, name: 'Broccoli', brand: null, isFavorite: false, logCount: 0, energyDensity: null }
]

function foodDetail(id: number) {
  return { id, servings: [{ id: id * 10, kind: 'named', label: 'serving', quantity: 1, basisGrams: null,
    hasOwnNutrition: true, nutrients: {} }] }
}

function registerFoodDetailEndpoints() {
  for (const hit of recentHits) registerEndpoint(`/api/nutrition/foods/${hit.id}`, () => foodDetail(hit.id))
}

describe('NutritionFoodSearch', () => {
  it('renders the recent hits and adds the checked entries as one submit event', async () => {
    registerEndpoint('/api/nutrition/foods/recent', () => recentHits)
    registerFoodDetailEndpoints()

    const wrapper = await mountSuspended(NutritionFoodSearch, {
      props: { date: '2026-07-03', containers: [{ id: 7, name: 'Breakfast' }] }
    })
    await flushPromises()

    expect(wrapper.findAll('[data-test="food-hit"]')).toHaveLength(3)

    const checkboxes = wrapper.findAllComponents(CheckboxCtor)
    await checkboxes[0]!.vm.$emit('update:modelValue', true)
    await checkboxes[1]!.vm.$emit('update:modelValue', true)

    await vi.waitFor(() => {
      expect(wrapper.findAllComponents(NutritionAmountInput)).toHaveLength(2)
    })

    const amountInputs = wrapper.findAllComponents(NutritionAmountInput)
    await amountInputs[0]!.vm.$emit('update:modelValue', { quantity: 2, unitLabel: 'serving' })
    await amountInputs[1]!.vm.$emit('update:modelValue', { quantity: 3, unitLabel: 'serving' })

    await wrapper.find('[data-test="add-selected"]').trigger('click')

    const submitted = wrapper.emitted('submit')
    expect(submitted).toHaveLength(1)
    expect(submitted![0]![0]).toEqual([
      { entryType: 'food', foodId: 1, containerId: 7, quantity: 2, unitLabel: 'serving' },
      { entryType: 'food', foodId: 2, containerId: 7, quantity: 3, unitLabel: 'serving' }
    ])
  })

  it('shows a hint when the search provider is degraded', async () => {
    registerEndpoint('/api/nutrition/foods/recent', () => recentHits)
    registerEndpoint('/api/nutrition/foods/search', () => ({ hits: recentHits, degraded: true }))
    registerFoodDetailEndpoints()

    const wrapper = await mountSuspended(NutritionFoodSearch, {
      props: { date: '2026-07-03', containers: [{ id: 7, name: 'Breakfast' }] }
    })
    await flushPromises()

    vi.useFakeTimers()
    await wrapper.find('[data-test="food-search-input"]').setValue('chicken')
    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()

    await vi.waitFor(() => {
      expect(wrapper.find('[data-test="degraded-hint"]').exists()).toBe(true)
    })
    expect(wrapper.text()).toContain('Search is running in basic mode')
  })
})
