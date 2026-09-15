import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { USelect } from '#components'
import NutritionAmountInput from '../../app/components/nutrition/NutritionAmountInput.vue'
import type { FoodForResolve } from '../../shared/types/nutrition'

const sliceOnly: FoodForResolve = {
  id: 2,
  servings: [{ id: 20, kind: 'named', label: 'slice', quantity: 1, basisGrams: null,
    hasOwnNutrition: true, nutrients: { 1: 3 } }]
}

const withWeight: FoodForResolve = {
  id: 1,
  servings: [
    { id: 10, kind: 'named', label: 'slice', quantity: 1, basisGrams: null,
      hasOwnNutrition: true, nutrients: { 1: 3 } },
    { id: 11, kind: 'weight', label: 'g', quantity: 100, basisGrams: 100,
      hasOwnNutrition: true, nutrients: { 1: 1 } }
  ]
}

interface SelectProbe {
  props: (key: string) => unknown
}

describe('NutritionAmountInput', () => {
  it('offers no g option for a slice-only food', async () => {
    const wrapper = await mountSuspended(NutritionAmountInput, {
      props: { food: sliceOnly, modelValue: { quantity: 1, unitLabel: '' } }
    })
    const select = wrapper.findComponent(USelect) as unknown as SelectProbe
    const items = select.props('items') as { value: string }[]
    expect(items.some((i) => i.value === 'g')).toBe(false)
  })

  it('preselects g for a food with a weight basis', async () => {
    const wrapper = await mountSuspended(NutritionAmountInput, {
      props: { food: withWeight, modelValue: { quantity: 1, unitLabel: '' } }
    })
    const select = wrapper.findComponent(USelect) as unknown as SelectProbe
    expect(select.props('modelValue')).toBe('g')
  })

  it('emits the defaulted unit back to the parent', async () => {
    const wrapper = await mountSuspended(NutritionAmountInput, {
      props: { food: withWeight, modelValue: { quantity: 1, unitLabel: '' } }
    })
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.[0]?.[0]).toEqual({ quantity: 1, unitLabel: 'g' })
  })
})
