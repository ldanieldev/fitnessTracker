import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import { flushPromises } from '@vue/test-utils'
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

  it('seeds the barcode input from prefill', async () => {
    const wrapper = await mountSuspended(NutritionFoodForm, { props: { prefill: { barcode: '3017624010701' } } })

    expect((wrapper.find('[data-test="food-barcode"]').element as HTMLInputElement).value).toBe('3017624010701')
  })

  it('applies a parsed OCR result as one named serving, replacing the empty default row', async () => {
    const wrapper = await mountSuspended(NutritionFoodForm)

    await wrapper.find('[data-test="ocr-open"]').trigger('click')
    await wrapper.findComponent({ name: 'NutritionLabelOcr' }).vm.$emit('parsed', {
      servingGrams: 55,
      nutrients: { energy: 230, protein: 3, carbohydrate: 37, fat: 8 },
      confidence: 0.9
    })

    const rows = wrapper.findAll('[data-test="serving-row"]')
    expect(rows).toHaveLength(1)
    expect((wrapper.find('[data-test="serving-label"]').element as HTMLInputElement).value).toBe('serving')
    expect((wrapper.find('[data-test="serving-energy"]').element as HTMLInputElement).value).toBe('230')
    expect((wrapper.find('[data-test="serving-protein"]').element as HTMLInputElement).value).toBe('3')
    expect((wrapper.find('[data-test="serving-carbohydrate"]').element as HTMLInputElement).value).toBe('37')
    expect((wrapper.find('[data-test="serving-fat"]').element as HTMLInputElement).value).toBe('8')
    expect((wrapper.find('[data-test="serving-basis-grams"]').element as HTMLInputElement).value).toBe('55')
  })

  it('shows tracked extras and applies OCR nutrients only where a field exists', async () => {
    registerEndpoint('/api/nutrition/nutrients/tracked', () => [
      { key: 'energy', name: 'Calories', unit: 'kcal', sortOrder: 0 },
      { key: 'fiber', name: 'Fiber', unit: 'g', sortOrder: 1 }
    ])
    const wrapper = await mountSuspended(NutritionFoodForm)
    await flushPromises()
    expect(wrapper.find('[data-test="serving-fiber"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="serving-sodium"]').exists()).toBe(false)

    await wrapper.find('[data-test="ocr-open"]').trigger('click')
    await wrapper.findComponent({ name: 'NutritionLabelOcr' }).vm.$emit('parsed', {
      servingGrams: 30, nutrients: { energy: 120, fiber: 4, sodium: 90 }, confidence: 0.9
    })
    expect((wrapper.find('[data-test="serving-fiber"]').element as HTMLInputElement).value).toBe('4')
  })

  it('sends tracked extras in the create body', async () => {
    registerEndpoint('/api/nutrition/nutrients/tracked', () => [{ key: 'fiber', name: 'Fiber', unit: 'g', sortOrder: 0 }])
    let captured: { servings: Array<{ nutrients?: Record<string, number> }> } | undefined
    registerEndpoint('/api/nutrition/foods', {
      method: 'POST',
      handler: async (event) => {
        captured = await readBody(event)
        return { id: 1 }
      }
    })
    const wrapper = await mountSuspended(NutritionFoodForm)
    await flushPromises()
    await wrapper.find('[data-test="food-name"]').setValue('Fiber Bar')
    await wrapper.find('[data-test="serving-label"]').setValue('bar')
    await wrapper.find('[data-test="serving-energy"]').setValue('200')
    await wrapper.find('[data-test="serving-fiber"]').setValue('9')
    await wrapper.find('[data-test="food-submit"]').trigger('click')
    await vi.waitFor(() => expect(captured).toBeDefined())
    expect(captured!.servings[0]!.nutrients).toEqual({ energy: 200, fiber: 9 })
  })
})
