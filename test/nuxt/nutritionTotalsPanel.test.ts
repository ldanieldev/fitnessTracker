import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import NutritionTotalsPanel from '../../app/components/nutrition/NutritionTotalsPanel.vue'

describe('NutritionTotalsPanel', () => {
  it('keeps the total and per-serving hooks and renders macro bars', async () => {
    registerEndpoint('/api/nutrition/nutrients/tracked', () => [{ key: 'fiber', name: 'Fiber', unit: 'g', sortOrder: 0 }])
    const wrapper = await mountSuspended(NutritionTotalsPanel, {
      props: { total: { energy: 500, protein: 21, carbohydrate: 67, fat: 9, fiber: 8 }, perServing: { energy: 250, protein: 10.5, carbohydrate: 33.5, fat: 4.5, fiber: 4 }, servingName: 'bowl' }
    })
    expect(wrapper.find('[data-test="total-energy"]').text()).toContain('500')
    expect(wrapper.find('[data-test="per-serving-energy"]').text()).toContain('250')
    expect(wrapper.findAll('[data-test^="bar-"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('Fib')
  })

  it('keeps the protein/carb/fat total hooks even with nothing tracked beyond the macros', async () => {
    registerEndpoint('/api/nutrition/nutrients/tracked', () => [])
    const wrapper = await mountSuspended(NutritionTotalsPanel, {
      props: { total: { energy: 500, protein: 21, carbohydrate: 67, fat: 9 } }
    })
    expect(wrapper.find('[data-test="total-protein"]').text()).toContain('21')
  })
})
