import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import NutritionFoodForm from '../../app/components/nutrition/NutritionFoodForm.vue'

describe('NutritionFoodForm', () => {
  it('sends both nutrients and basisGrams when a named serving row has both', async () => {
    let capturedBody: { servings: Array<{ nutrients?: Record<string, number>, basisGrams?: number }> } | undefined

    registerEndpoint('/api/nutrition/foods', {
      method: 'POST',
      handler: async (event) => {
        capturedBody = await readBody(event)
        return { id: 42 }
      }
    })

    const wrapper = await mountSuspended(NutritionFoodForm)

    await wrapper.find('[data-test="food-name"]').setValue('Slice-first Pizza')
    await wrapper.find('[data-test="serving-label"]').setValue('slice')
    await wrapper.find('[data-test="serving-protein"]').setValue('10')
    await wrapper.find('[data-test="serving-basis-grams"]').setValue('130')

    await wrapper.find('[data-test="food-submit"]').trigger('click')
    await vi.waitFor(() => expect(capturedBody).toBeDefined())

    expect(capturedBody!.servings[0]).toMatchObject({
      nutrients: { protein: 10 },
      basisGrams: 130
    })
  })
})
