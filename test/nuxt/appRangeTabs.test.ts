import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppRangeTabs from '../../app/components/AppRangeTabs.vue'

describe('AppRangeTabs', () => {
  it('offers month-to-date as the first of six presets', async () => {
    const wrapper = await mountSuspended(AppRangeTabs, { props: { modelValue: '3m' } })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((t) => t.text())).toEqual(['MTD', '1m', '3m', '6m', '1y', 'All'])
  })
})
