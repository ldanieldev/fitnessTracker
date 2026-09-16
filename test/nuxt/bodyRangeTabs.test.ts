import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BodyRangeTabs from '../../app/components/body/BodyRangeTabs.vue'

describe('BodyRangeTabs', () => {
  it('offers month-to-date as the first of six presets', async () => {
    const wrapper = await mountSuspended(BodyRangeTabs, { props: { modelValue: '3m' } })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((t) => t.text())).toEqual(['MTD', '1m', '3m', '6m', '1y', 'All'])
  })
})
