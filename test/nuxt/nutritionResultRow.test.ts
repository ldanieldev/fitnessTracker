import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NutritionResultRow from '../../app/components/nutrition/NutritionResultRow.vue'

describe('NutritionResultRow', () => {
  it('exposes the row as a real title button instead of a button role around nested controls', async () => {
    const wrapper = await mountSuspended(NutritionResultRow, { props: { title: 'Oats', dataTest: 'hit', selectable: true, selected: false } })
    expect(wrapper.find('[role="button"]').exists()).toBe(false)
    const title = wrapper.find('button[data-test="hit-title"]')
    expect(title.text()).toBe('Oats')
    expect(title.attributes('aria-pressed')).toBe('false')
    await title.trigger('click')
    expect(wrapper.emitted('toggle')).toEqual([[true]])
  })

  it('still toggles from a tap anywhere on the row and opens chevron rows', async () => {
    const wrapper = await mountSuspended(NutritionResultRow, { props: { title: 'Oats', dataTest: 'hit', chevron: true } })
    await wrapper.find('[data-test="hit"] > div').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
    expect(wrapper.find('button[data-test="hit-title"]').attributes('aria-pressed')).toBeUndefined()
  })
})
