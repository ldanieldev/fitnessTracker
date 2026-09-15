import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NutritionMacroDonut from '../../app/components/nutrition/NutritionMacroDonut.vue'

describe('NutritionMacroDonut', () => {
  it('renders nothing when protein, carbs and fat are all missing', async () => {
    const wrapper = await mountSuspended(NutritionMacroDonut, { props: { nutrients: {} } })
    expect(wrapper.html()).toBe('<!--v-if-->')
  })

  it('shows a legend row per slice with its grams and calorie-share percent, plus an sr-only summary', async () => {
    const wrapper = await mountSuspended(NutritionMacroDonut, {
      props: { nutrients: { protein: 25, carbohydrate: 25, fat: 10 } }
    })
    expect(wrapper.find('[data-test="donut-protein"]').text()).toContain('25')
    expect(wrapper.find('[data-test="donut-protein"]').text()).toContain('35%')
    expect(wrapper.find('[data-test="donut-carbohydrate"]').text()).toContain('25')
    expect(wrapper.find('[data-test="donut-carbohydrate"]').text()).toContain('34%')
    expect(wrapper.find('[data-test="donut-fat"]').text()).toContain('10')
    expect(wrapper.find('[data-test="donut-fat"]').text()).toContain('31%')
    expect(wrapper.find('[data-test="donut-other"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('by calories')
    expect(wrapper.find('.sr-only').text()).toContain('Protein')
  })
})
