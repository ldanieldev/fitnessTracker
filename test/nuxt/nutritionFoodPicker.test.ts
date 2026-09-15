import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { ComponentPublicInstance } from 'vue'
import { UCheckbox } from '#components'
import NutritionFoodPicker from '../../app/components/nutrition/NutritionFoodPicker.vue'
import NutritionAmountInput from '../../app/components/nutrition/NutritionAmountInput.vue'
import type { FoodDetail, PickedFood } from '../../app/types/nutrition'

const CheckboxCtor = UCheckbox as unknown as new () => ComponentPublicInstance

const recentHits = [
  {
    id: 1,
    name: 'Chicken Breast',
    brand: 'Acme',
    isFavorite: false,
    logCount: 3,
    perDefault: { label: 'g', quantity: 100, energy: 165, protein: 31, carbohydrate: 0, fat: 3.6 }
  },
  { id: 2, name: 'Brown Rice', brand: null, isFavorite: true, logCount: 5 }
]

function detail(id: number, name: string): FoodDetail {
  return {
    id, name, brand: null, barcode: null, createdByUserId: 1, source: null, defaultServingId: id * 10, energyDensity: null,
    servings: [{ id: id * 10, kind: 'named' as const, label: 'serving', quantity: 1, basisGrams: null, hasOwnNutrition: true, nutrients: {} }]
  } as FoodDetail
}

function register() {
  registerEndpoint('/api/nutrition/foods/recent', () => recentHits)
  registerEndpoint('/api/nutrition/foods/1', () => detail(1, 'Chicken Breast'))
  registerEndpoint('/api/nutrition/foods/2', () => detail(2, 'Brown Rice'))
  registerEndpoint('/api/nutrition/foods/9', () => detail(9, 'Scanned Bar'))
}

async function mountPicker(props: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(NutritionFoodPicker, {
    props: {
      modelValue: [] as PickedFood[],
      'onUpdate:modelValue': (value: PickedFood[]) => wrapper.setProps({ modelValue: value }),
      ...props
    }
  })
  await flushPromises()
  return wrapper
}

describe('NutritionFoodPicker', () => {
  it('picks checked foods with their amounts through v-model', async () => {
    register()
    const wrapper = await mountPicker()
    expect(wrapper.findAll('[data-test="food-hit"]')).toHaveLength(2)

    const checkboxes = wrapper.findAllComponents(CheckboxCtor)
    await checkboxes[0]!.vm.$emit('update:modelValue', true)
    await checkboxes[1]!.vm.$emit('update:modelValue', true)
    await vi.waitFor(() => expect(wrapper.findAllComponents(NutritionAmountInput)).toHaveLength(2))

    await wrapper.findAllComponents(NutritionAmountInput)[0]!.vm.$emit('update:modelValue', { quantity: 2, unitLabel: 'serving' })

    const model = wrapper.props('modelValue') as PickedFood[]
    expect(model.map((p) => [p.foodId, p.quantity, p.unitLabel])).toEqual([[1, 2, 'serving'], [2, 1, 'serving']])
    expect(model[0]!.food.name).toBe('Chicken Breast')
  })

  it('fills the star only for favourited foods', async () => {
    register()
    const wrapper = await mountPicker()
    const icons = wrapper.findAll('[data-test="favorite-icon"]')
    expect(icons).toHaveLength(2)
    expect(icons[0]!.classes()).not.toContain('[&_path]:fill-current')
    expect(icons[1]!.classes()).toContain('[&_path]:fill-current')
  })

  it('keeps one pick when multiple is false', async () => {
    register()
    const wrapper = await mountPicker({ multiple: false })
    const checkboxes = wrapper.findAllComponents(CheckboxCtor)
    await checkboxes[0]!.vm.$emit('update:modelValue', true)
    await vi.waitFor(() => expect((wrapper.props('modelValue') as PickedFood[])).toHaveLength(1))
    await checkboxes[1]!.vm.$emit('update:modelValue', true)
    await vi.waitFor(() => expect((wrapper.props('modelValue') as PickedFood[]).map((p) => p.foodId)).toEqual([2]))
  })

  it('select() prepends and picks a food that is not in the hits', async () => {
    register()
    const wrapper = await mountPicker()
    await (wrapper.vm as unknown as { select: (id: number) => Promise<void> }).select(9)
    await flushPromises()
    expect(wrapper.findAll('[data-test="food-hit"]')[0]!.text()).toContain('Scanned Bar')
    expect((wrapper.props('modelValue') as PickedFood[]).map((p) => p.foodId)).toEqual([9])
  })

  it('keeps a picked food visible when a later list response does not contain it', async () => {
    register()
    const wrapper = await mountPicker()
    await (wrapper.vm as unknown as { select: (id: number) => Promise<void> }).select(9)
    await flushPromises()
    await (wrapper.vm as unknown as { runSearch: () => Promise<void> }).runSearch()
    await flushPromises()
    const names = wrapper.findAll('[data-test="food-hit"]').map((row) => row.text())
    expect(names[0]).toContain('Scanned Bar')
    expect(names).toHaveLength(3)
  })

  it('shows the degraded hint from search', async () => {
    register()
    registerEndpoint('/api/nutrition/foods/search', () => ({ hits: recentHits, degraded: true }))
    const wrapper = await mountPicker()
    vi.useFakeTimers()
    await wrapper.find('[data-test="food-search-input"]').setValue('chicken')
    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()
    await vi.waitFor(() => expect(wrapper.find('[data-test="degraded-hint"]').exists()).toBe(true))
  })

  it('drops a slow recents response that resolves after a newer search response', async () => {
    registerEndpoint('/api/nutrition/foods/recent', async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return [{ id: 5, name: 'Late Recent', brand: null, isFavorite: false, logCount: 0 }]
    })
    registerEndpoint('/api/nutrition/foods/search', () => ({
      hits: [{ id: 1, name: 'Chicken', brand: null, isFavorite: false, logCount: 0, energyDensity: null }], degraded: false
    }))
    vi.useFakeTimers()
    const wrapper = await mountPicker()
    await wrapper.find('[data-test="food-search-input"]').setValue('chi')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    vi.useRealTimers()
    const names = wrapper.findAll('[data-test="food-hit"]').map((hit) => hit.text())
    expect(names.some((text) => text.includes('Chicken'))).toBe(true)
    expect(names.some((text) => text.includes('Late Recent'))).toBe(false)
  })

  it('links the needs-nutrition alert to the food editor', async () => {
    register()
    const wrapper = await mountPicker({ needsNutritionFoodId: 9 })
    const alert = wrapper.find('[data-test="needs-nutrition-alert"]')
    expect(alert.exists()).toBe(true)
    expect(alert.find('a').attributes('href')).toBe('/nutrition/foods/9')
  })

  it('shows the default-serving macros on every hit', async () => {
    register()
    const wrapper = await mountPicker()
    const first = wrapper.findAll('[data-test="food-hit"]')[0]!
    expect(first.find('[data-test="macro-protein"]').text()).toBe('P 31')
    expect(first.text()).toContain('100 g')
  })

  it('shows the brand on a hit with macros', async () => {
    register()
    const wrapper = await mountPicker()
    const first = wrapper.findAll('[data-test="food-hit"]')[0]!
    expect(first.text()).toContain('Acme')
  })

  it('shows a skeleton instead of the empty text before the first search resolves', async () => {
    let resolveFetch: (() => void) | undefined
    registerEndpoint('/api/nutrition/foods/recent', () => new Promise((resolve) => {
      resolveFetch = () => resolve([])
    }))
    const wrapper = await mountSuspended(NutritionFoodPicker, {
      props: { modelValue: [] as PickedFood[], 'onUpdate:modelValue': () => {} }
    })

    expect(wrapper.find('[data-test="list-skeleton"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('No foods found')

    resolveFetch?.()
    await vi.waitFor(() => expect(wrapper.find('[data-test="list-skeleton"]').exists()).toBe(false))
    expect(wrapper.text()).toContain('No foods found')
  })

  it('labels the search input for assistive tech', async () => {
    register()
    const wrapper = await mountPicker()
    expect(wrapper.find('[data-test="food-search-input"]').attributes('aria-label')).toBe('Search foods')
  })

  it('offers "Remove from recents" only on the recent source, and it hides then refreshes the list', async () => {
    register()
    const wrapper = await mountPicker({ source: 'recent' })
    const menu = (wrapper.vm as unknown as { hitMenu: (hit: { id: number }) => Array<Array<{ label: string }>> }).hitMenu({ id: 1 })
    expect(menu[0]!.map((item) => item.label)).toEqual(['View food', 'Remove from recents'])

    let deleteCalled = false
    registerEndpoint('/api/nutrition/foods/1/recent', { method: 'DELETE', handler: () => {
      deleteCalled = true
      return { ok: true }
    } })
    await (menu[0]![1] as unknown as { onSelect: () => Promise<void> }).onSelect()
    await flushPromises()
    expect(deleteCalled).toBe(true)
  })

  it('does not offer "Remove from recents" on the favorites or mine source', async () => {
    register()
    const favWrapper = await mountPicker({ source: 'favorites' })
    const favMenu = (favWrapper.vm as unknown as { hitMenu: (hit: { id: number }) => Array<Array<{ label: string }>> }).hitMenu({ id: 1 })
    expect(favMenu[0]!.map((item) => item.label)).toEqual(['View food'])

    registerEndpoint('/api/nutrition/foods', () => [])
    const mineWrapper = await mountPicker({ source: 'mine' })
    const mineMenu = (mineWrapper.vm as unknown as { hitMenu: (hit: { id: number }) => Array<Array<{ label: string }>> }).hitMenu({ id: 1 })
    expect(mineMenu[0]!.map((item) => item.label)).toEqual(['View food'])
  })

  it('preserves quantity and unitLabel when select() is called on an already-picked food', async () => {
    register()
    const initialPicked: PickedFood[] = [{ foodId: 1, name: 'Chicken Breast', brand: null, quantity: 3, unitLabel: 'serving', food: detail(1, 'Chicken Breast') }]
    const wrapper = await mountPicker({ modelValue: initialPicked })
    await (wrapper.vm as unknown as { select: (id: number) => Promise<void> }).select(1)
    await flushPromises()
    const model = wrapper.props('modelValue') as PickedFood[]
    expect(model).toHaveLength(1)
    expect(model[0]!.quantity).toBe(3)
    expect(model[0]!.unitLabel).toBe('serving')
  })
})
