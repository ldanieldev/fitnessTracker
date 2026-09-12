import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NutritionMacroText from '../../app/components/nutrition/NutritionMacroText.vue'

describe('NutritionMacroText', () => {
  it('renders each macro in its colour class', async () => {
    const wrapper = await mountSuspended(NutritionMacroText, { props: { nutrients: { protein: 18, carbohydrate: 0, fat: 15 } } })
    expect(wrapper.find('[data-test="macro-protein"]').classes()).toContain('text-protein')
    expect(wrapper.find('[data-test="macro-protein"]').text()).toBe('P 18')
    expect(wrapper.text().replace(/\s+/g, ' ')).toBe('P 18 · C 0 · F 15')
  })
})
