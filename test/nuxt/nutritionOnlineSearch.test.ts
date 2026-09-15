import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import NutritionOnlineSearch from '../../app/components/nutrition/NutritionOnlineSearch.vue'

const results = [
  {
    source: 'off',
    externalId: '123',
    name: 'Nutella',
    brand: 'Ferrero',
    barcode: '3017624010701',
    hasNutrition: true,
    attribution: 'Open Food Facts contributors',
    per100g: { energy: 539, protein: 6.3, carbohydrate: 57.5, fat: 30.9 }
  }
]

const errors = [{ source: 'usda', kind: 'rate_limited', message: 'rate limited' }]

async function searchNutella(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  await wrapper.find('[data-test="online-query"]').setValue('nutella')
  await wrapper.find('[data-test="online-search"]').trigger('click')
  await flushPromises()
}

describe('NutritionOnlineSearch', () => {
  it('renders results with a source badge and attribution, and a per-source error alert', async () => {
    registerEndpoint('/api/nutrition/foods/search/external', () => ({ results, errors }))

    const wrapper = await mountSuspended(NutritionOnlineSearch)
    await searchNutella(wrapper)

    expect(wrapper.findAll('[data-test="online-result"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Nutella')
    expect(wrapper.text()).toContain('Ferrero')
    expect(wrapper.text()).toContain('Open Food Facts contributors')
    expect(wrapper.text()).toContain('539')
    expect(wrapper.find('[data-test="macro-fat"]').text()).toBe('F 30.9')

    expect(wrapper.find('[data-test="online-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Search is unavailable for USDA: rate limited')
  })

  it('shows "No nutrition data" and no macros for a result with an empty per100g', async () => {
    registerEndpoint('/api/nutrition/foods/search/external', () => ({
      results: [{
        source: 'usda',
        externalId: '456',
        name: 'Mystery Bar',
        brand: null,
        barcode: null,
        hasNutrition: false,
        attribution: null,
        per100g: {}
      }],
      errors: []
    }))

    const wrapper = await mountSuspended(NutritionOnlineSearch)
    await searchNutella(wrapper)

    expect(wrapper.text()).toContain('No nutrition data')
    expect(wrapper.find('[data-test="macro-protein"]').exists()).toBe(false)
  })

  it('imports a result: posts the source and externalId, and emits imported', async () => {
    registerEndpoint('/api/nutrition/foods/search/external', () => ({ results, errors: [] }))
    let capturedBody: unknown
    registerEndpoint('/api/nutrition/foods/import', {
      method: 'POST',
      handler: async (event) => {
        capturedBody = await readBody(event)
        return { id: 42, needsNutrition: false, owned: false }
      }
    })

    const wrapper = await mountSuspended(NutritionOnlineSearch)
    await searchNutella(wrapper)

    await wrapper.find('[data-test="online-import"]').trigger('click')
    await vi.waitFor(() => expect(capturedBody).toBeDefined())
    await vi.waitFor(() => expect(wrapper.emitted('imported')).toHaveLength(1))

    expect(capturedBody).toEqual({ source: 'off', externalId: '123' })
    const emitted = wrapper.emitted('imported')
    expect(emitted![0]![0]).toEqual({ id: 42, needsNutrition: false })
  })

  it('emits imported with needsNutrition: true when the import needs nutrition (P2-R29)', async () => {
    registerEndpoint('/api/nutrition/foods/search/external', () => ({ results, errors: [] }))
    registerEndpoint('/api/nutrition/foods/import', {
      method: 'POST',
      handler: async () => ({ id: 7, needsNutrition: true, owned: false })
    })

    const wrapper = await mountSuspended(NutritionOnlineSearch)
    await searchNutella(wrapper)

    await wrapper.find('[data-test="online-import"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('imported')).toHaveLength(1))

    const emitted = wrapper.emitted('imported')
    expect(emitted![0]![0]).toEqual({ id: 7, needsNutrition: true })
  })
})
