import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NutritionServingPreview from '../../app/components/nutrition/NutritionServingPreview.vue'

describe('NutritionServingPreview', () => {
  it('shows kcal and macros for the draft as typed', async () => {
    const wrapper = await mountSuspended(NutritionServingPreview, {
      props: { draft: { kind: 'named', label: 'slice', quantity: 1, basisGrams: '40', nutrients: { energy: '90', protein: '3.2', carbohydrate: '17', fat: '1' } } }
    })
    expect(wrapper.text()).toContain('per 1 slice')
    expect(wrapper.find('[data-test="macro-energy"]').text()).toBe('kcal 90')
    expect(wrapper.find('[data-test="macro-protein"]').text()).toBe('P 3.2')
  })

  it('explains a derived serving', async () => {
    const wrapper = await mountSuspended(NutritionServingPreview, {
      props: { draft: { kind: 'named', label: 'slice', quantity: 1, basisGrams: '40', nutrients: {} } }
    })
    expect(wrapper.text()).toContain('derives from gram weight')
  })
})
