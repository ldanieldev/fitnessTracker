import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NutritionAddRecipes from '../../app/components/nutrition/NutritionAddRecipes.vue'

const recipes: Array<{ id: number, name: string, servings: number, servingName: string, perServing: Record<string, number>, broken: boolean }> = [
  { id: 1, name: 'Chili', servings: 4, servingName: 'bowl', perServing: { energy: 450, protein: 30 }, broken: false },
  { id: 2, name: 'Broken Pie', servings: 8, servingName: 'slice', perServing: {}, broken: true }
]

describe('NutritionAddRecipes', () => {
  it('filters by name, disables broken recipes with a fix link, and emits servings', async () => {
    const wrapper = await mountSuspended(NutritionAddRecipes, {
      props: { recipes, selected: [{ recipeId: 1, name: 'Chili', servings: 1, servingName: 'bowl', perServing: { energy: 450, protein: 30 } }] }
    })
    expect(wrapper.findAll('[data-test="recipe-choice"]')).toHaveLength(2)
    const broken = wrapper.findAll('[data-test="recipe-choice"]')[1]!
    expect(broken.find('[data-test="recipe-choice-checkbox"] button, [data-test="recipe-choice-checkbox"]').attributes('disabled')).toBeDefined()
    expect(broken.find('[data-test="recipe-fix-link"]').attributes('href')).toBe('/nutrition/recipes/2')

    const servingsInput = wrapper.find('input[data-test="recipe-choice-servings"]')
    await servingsInput.setValue('2')
    await servingsInput.trigger('blur')
    expect(wrapper.emitted('servings')?.at(-1)).toEqual([1, 2])

    await wrapper.find('input[data-test="recipe-search"], [data-test="recipe-search"] input').setValue('chi')
    expect(wrapper.findAll('[data-test="recipe-choice"]')).toHaveLength(1)
  })
})
