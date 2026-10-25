import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import { flushPromises } from '@vue/test-utils'
import NutritionFoodForm from '../../app/components/nutrition/NutritionFoodForm.vue'

const { toastAddMock } = vi.hoisted(() => ({ toastAddMock: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: toastAddMock }))

const value = (el: { element: Element }) => (el.element as HTMLInputElement).value

describe('NutritionFoodForm', () => {
  it('sends both nutrients and basisGrams when a named serving row has both', async () => {
    let capturedBody: { servings: Array<{ nutrients?: Record<string, number>; basisGrams?: number }> } | undefined

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

  it('offers a barcode scan button beside the barcode input', async () => {
    const wrapper = await mountSuspended(NutritionFoodForm)

    expect(wrapper.find('[data-test="food-barcode-scan"]').exists()).toBe(true)
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
    expect((wrapper.find('[data-test="serving-energy"]').element as HTMLInputElement).value).toBe('232')
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
      servingGrams: 30,
      nutrients: { energy: 120, fiber: 4, sodium: 90 },
      confidence: 0.9
    })
    expect((wrapper.find('[data-test="serving-fiber"]').element as HTMLInputElement).value).toBe('4')
  })

  it('sends tracked extras in the create body', async () => {
    registerEndpoint('/api/nutrition/nutrients/tracked', () => [
      { key: 'fiber', name: 'Fiber', unit: 'g', sortOrder: 0 }
    ])
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
    await wrapper.find('[data-test="serving-protein"]').setValue('10')
    await wrapper.find('[data-test="serving-fiber"]').setValue('9')
    await wrapper.find('[data-test="food-submit"]').trigger('click')
    await vi.waitFor(() => expect(captured).toBeDefined())
    expect(captured!.servings[0]!.nutrients).toEqual({ protein: 10, fiber: 9, energy: 40 })
  })

  it('fills the blank brand and replaces the empty default row with a 100 g serving after a barcode scan', async () => {
    registerEndpoint('/api/nutrition/foods/barcode/4017624010717', () => ({
      found: 'off',
      external: {
        source: 'off',
        externalId: '4017624010717',
        name: 'Stub Cheerios',
        brand: 'Stub Mills',
        barcode: '4017624010717',
        per100g: { energy: 379.4, protein: 7.46 },
        servingGrams: null,
        servingLabel: null,
        attribution: null
      }
    }))
    const wrapper = await mountSuspended(NutritionFoodForm)
    await wrapper.find('[data-test="food-name"]').setValue('My Cheerios')

    wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '4017624010717')
    await vi.waitFor(() =>
      expect((wrapper.find('[data-test="food-brand"]').element as HTMLInputElement).value).toBe('Stub Mills')
    )
    await flushPromises()

    expect((wrapper.find('[data-test="food-name"]').element as HTMLInputElement).value).toBe('My Cheerios')
    expect(wrapper.findAll('[data-test="serving-energy"]')).toHaveLength(1)
    expect((wrapper.find('[data-test="serving-energy"]').element as HTMLInputElement).value).toBe('30')
    expect((wrapper.find('[data-test="serving-protein"]').element as HTMLInputElement).value).toBe('7.5')
  })

  it('shows a read-only calories field computed from the macros and sends it', async () => {
    let captured: { servings: Array<{ nutrients?: Record<string, number> }> } | undefined
    registerEndpoint('/api/nutrition/foods', {
      method: 'POST',
      handler: async (event) => {
        captured = await readBody(event)
        return { id: 1 }
      }
    })
    const wrapper = await mountSuspended(NutritionFoodForm)
    const energy = wrapper.find('[data-test="serving-energy"]')
    expect(energy.attributes('readonly')).toBeDefined()
    expect((energy.element as HTMLInputElement).value).toBe('')
    await wrapper.find('[data-test="food-name"]').setValue('Calc Bar')
    await wrapper.find('[data-test="serving-label"]').setValue('bar')
    await wrapper.find('[data-test="serving-protein"]').setValue('3')
    await wrapper.find('[data-test="serving-carbohydrate"]').setValue('2')
    await wrapper.find('[data-test="serving-fat"]').setValue('5')
    expect((wrapper.find('[data-test="serving-energy"]').element as HTMLInputElement).value).toBe('65')
    await wrapper.find('[data-test="food-submit"]').trigger('click')
    await vi.waitFor(() => expect(captured).toBeDefined())
    expect(captured!.servings[0]!.nutrients).toMatchObject({ energy: 65 })
  })

  describe('source kcal warning', () => {
    const biscoff = { energy: 566.7, protein: 5, carbohydrate: 20, fat: 7.9 }
    const offMessage =
      'Open Food Facts says 567 kcal per 100 g, the macros give 171. Check the macros against the label.'

    function stubBarcode(code: string, per100g: Record<string, number>) {
      toastAddMock.mockClear()
      registerEndpoint(`/api/nutrition/foods/barcode/${code}`, () => ({
        found: 'off',
        external: {
          source: 'off',
          externalId: code,
          name: 'Stub',
          brand: 'Stub',
          barcode: code,
          per100g,
          servingGrams: null,
          servingLabel: null,
          attribution: null
        }
      }))
    }

    it('warns after a barcode fill whose macros disagree with its kcal', async () => {
      stubBarcode('5000000000011', biscoff)
      const wrapper = await mountSuspended(NutritionFoodForm)
      wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '5000000000011')
      await vi.waitFor(() => expect(wrapper.find('[data-test="energy-mismatch"]').exists()).toBe(true))
      expect(wrapper.find('[data-test="energy-mismatch"]').text()).toContain(offMessage)
    })

    it('stays quiet when every serving already has its macros typed', async () => {
      stubBarcode('5000000000028', biscoff)
      const wrapper = await mountSuspended(NutritionFoodForm, {
        props: {
          prefill: {
            servings: [
              {
                kind: 'weight',
                label: 'g',
                quantity: 100,
                nutrients: { protein: '1', carbohydrate: '2', fat: '3' }
              }
            ]
          }
        }
      })
      wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '5000000000028')
      await vi.waitFor(() => expect(toastAddMock).toHaveBeenCalled())
      expect(wrapper.find('[data-test="energy-mismatch"]').exists()).toBe(false)
    })

    it('does not warn or replace the default row when the source has only kcal', async () => {
      stubBarcode('5000000000035', { energy: 200 })
      const wrapper = await mountSuspended(NutritionFoodForm)
      wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '5000000000035')
      await vi.waitFor(() => expect(toastAddMock).toHaveBeenCalled())
      expect(wrapper.find('[data-test="energy-mismatch"]').exists()).toBe(false)
      expect((wrapper.find('[data-test="serving-label"]').element as HTMLInputElement).value).toBe('')
    })

    it('adds no weight serving from kcal and a tracked extra without a macro, and says why', async () => {
      registerEndpoint('/api/nutrition/nutrients/tracked', () => [
        { key: 'energy', name: 'Calories', unit: 'kcal', sortOrder: 0 },
        { key: 'fiber', name: 'Fiber', unit: 'g', sortOrder: 1 }
      ])
      stubBarcode('5000000000059', { energy: 200, fiber: 3 })
      const wrapper = await mountSuspended(NutritionFoodForm)
      await flushPromises()
      expect(wrapper.find('[data-test="serving-fiber"]').exists()).toBe(true)
      await wrapper.find('[data-test="food-name"]').setValue('Stub')
      await wrapper.find('[data-test="food-brand"]').setValue('Stub')
      toastAddMock.mockClear()

      wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '5000000000059')
      await vi.waitFor(() => expect(toastAddMock).toHaveBeenCalled())

      expect(wrapper.findAll('[data-test="serving-row"]')).toHaveLength(1)
      expect(value(wrapper.find('[data-test="serving-label"]'))).toBe('')
      expect(value(wrapper.find('[data-test="serving-fiber"]'))).toBe('')
      expect(toastAddMock).toHaveBeenCalledWith({
        title: 'Nothing to fill',
        description: 'Open Food Facts has calories but no macros',
        color: 'neutral'
      })
    })

    it('clears the warning when a rescan finds nothing', async () => {
      stubBarcode('5000000000066', biscoff)
      registerEndpoint('/api/nutrition/foods/barcode/5000000000073', () => {
        throw createError({ statusCode: 404, statusMessage: 'Barcode not found', data: { errors: [] } })
      })
      const wrapper = await mountSuspended(NutritionFoodForm)
      await wrapper.find('[data-test="food-name"]').setValue('My spread')
      const field = wrapper.findComponent({ name: 'NutritionBarcodeField' })
      field.vm.$emit('scanned', '5000000000066')
      await vi.waitFor(() => expect(wrapper.find('[data-test="energy-mismatch"]').exists()).toBe(true))
      expect(wrapper.find('[data-test="barcode-suggestion-name"]').exists()).toBe(true)

      field.vm.$emit('scanned', '5000000000073')
      await vi.waitFor(() => expect(wrapper.find('[data-test="energy-mismatch"]').exists()).toBe(false))
      expect(wrapper.find('[data-test="barcode-suggestion-name"]').exists()).toBe(false)
    })

    it('does not warn after a label scan with kcal but no macro', async () => {
      const wrapper = await mountSuspended(NutritionFoodForm)
      await wrapper.find('[data-test="ocr-open"]').trigger('click')
      await wrapper.findComponent({ name: 'NutritionLabelOcr' }).vm.$emit('parsed', {
        servingGrams: 100,
        nutrients: { energy: 85 },
        confidence: 0.9
      })
      await flushPromises()
      expect(wrapper.find('[data-test="energy-mismatch"]').exists()).toBe(false)
    })

    it('warns after a label scan whose macros disagree with its kcal', async () => {
      const wrapper = await mountSuspended(NutritionFoodForm)
      await wrapper.find('[data-test="ocr-open"]').trigger('click')
      await wrapper.findComponent({ name: 'NutritionLabelOcr' }).vm.$emit('parsed', {
        servingGrams: 100,
        nutrients: { energy: 85, protein: 0.2, carbohydrate: 2.6, fat: 1.7 },
        confidence: 0.9
      })
      expect(wrapper.find('[data-test="energy-mismatch"]').text()).toContain(
        'The label says 85 kcal, the macros give 27. Check the macros against the label.'
      )
    })
  })

  describe('barcode name and brand hint', () => {
    function stubPeanuts() {
      registerEndpoint('/api/nutrition/foods/barcode/5000000000042', () => ({
        found: 'off',
        external: {
          source: 'off',
          externalId: '5000000000042',
          name: 'Dry Roasted Peanuts Seasoned with Sea Salt',
          brand: 'Great Value',
          barcode: '5000000000042',
          per100g: null,
          servingGrams: null,
          servingLabel: null,
          attribution: null
        }
      }))
    }

    it('offers a different barcode name and brand without changing the fields, and applies them on tap', async () => {
      stubPeanuts()
      const wrapper = await mountSuspended(NutritionFoodForm)
      await wrapper.find('[data-test="food-name"]').setValue('Dry roasted unsalted peanuts')
      await wrapper.find('[data-test="food-brand"]').setValue('Kirkland')

      wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '5000000000042')
      await vi.waitFor(() => expect(wrapper.find('[data-test="barcode-suggestion-name"]').exists()).toBe(true))

      expect((wrapper.find('[data-test="food-name"]').element as HTMLInputElement).value).toBe(
        'Dry roasted unsalted peanuts'
      )
      expect(wrapper.find('[data-test="barcode-suggestion-brand"]').text()).toContain('Barcode says: Great Value')

      await wrapper.find('[data-test="barcode-suggestion-name"] button').trigger('click')
      expect((wrapper.find('[data-test="food-name"]').element as HTMLInputElement).value).toBe(
        'Dry Roasted Peanuts Seasoned with Sea Salt'
      )
      expect(wrapper.find('[data-test="barcode-suggestion-name"]').exists()).toBe(false)
      expect(wrapper.find('[data-test="barcode-suggestion-brand"]').exists()).toBe(true)
    })

    it('hides a hint once the field is edited to match the barcode', async () => {
      stubPeanuts()
      const wrapper = await mountSuspended(NutritionFoodForm)
      await wrapper.find('[data-test="food-name"]').setValue('Dry roasted unsalted peanuts')
      await wrapper.find('[data-test="food-brand"]').setValue('Kirkland')

      wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '5000000000042')
      await vi.waitFor(() => expect(wrapper.find('[data-test="barcode-suggestion-brand"]').exists()).toBe(true))

      await wrapper.find('[data-test="food-brand"]').setValue('great value')
      expect(wrapper.find('[data-test="barcode-suggestion-brand"]').exists()).toBe(false)
      await wrapper.find('[data-test="food-brand"]').setValue('Costco')
      expect(wrapper.find('[data-test="barcode-suggestion-brand"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="barcode-suggestion-name"]').exists()).toBe(true)
    })

    it('shows no name hint when the name was blank, and none for a brand that differs only in case', async () => {
      stubPeanuts()
      const wrapper = await mountSuspended(NutritionFoodForm)
      await wrapper.find('[data-test="food-brand"]').setValue('Great value')

      wrapper.findComponent({ name: 'NutritionBarcodeField' }).vm.$emit('scanned', '5000000000042')
      await vi.waitFor(() =>
        expect((wrapper.find('[data-test="food-name"]').element as HTMLInputElement).value).toBe(
          'Dry Roasted Peanuts Seasoned with Sea Salt'
        )
      )
      await flushPromises()

      expect(wrapper.find('[data-test="barcode-suggestion-name"]').exists()).toBe(false)
      expect(wrapper.find('[data-test="barcode-suggestion-brand"]').exists()).toBe(false)
    })
  })
})
