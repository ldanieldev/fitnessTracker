import { h } from 'vue'
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BodyMetricCard from '../../app/components/body/BodyMetricCard.vue'

const type = { id: 1, key: 'bodyweight', name: 'Bodyweight', unit: 'lbs', precision: 1, direction: 'lower' as const, builtIn: true, hidden: false, sortOrder: null }
const entry = (id: number, value: number, day: string) => ({ id, typeId: 1, value, measuredAt: `${day}T08:25:00.000Z`, measuredOn: day })

describe('BodyMetricCard', () => {
  it('shows the latest value to the type precision, a signed delta in the direction colour, and links to the detail page', async () => {
    const wrapper = await mountSuspended(BodyMetricCard, {
      props: { metric: { type, latest: entry(2, 197, '2026-03-11'), previous: entry(1, 198.8, '2026-03-03'), goal: null, sparkline: [] } }
    })
    expect(wrapper.find('[data-test="metric-latest-1"]').text()).toBe('197.0')
    const delta = wrapper.find('[data-test="metric-delta-1"]')
    expect(delta.text()).toBe('-1.8')
    expect(delta.attributes('class')).toContain('success')
    expect(wrapper.find('a[data-test="metric-link-1"]').attributes('href')).toBe('/body/1')
  })

  it('renders an em dash and a prompt when nothing is logged, and emits log from the plus button', async () => {
    const wrapper = await mountSuspended(BodyMetricCard, {
      props: { metric: { type, latest: null, previous: null, goal: null, sparkline: [] } }
    })
    expect(wrapper.find('[data-test="metric-latest-1"]').text()).toBe('—')
    expect(wrapper.find('[data-test="metric-delta-1"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Tap + to record a value')
    await wrapper.find('[data-test="metric-log-1"]').trigger('click')
    expect(wrapper.emitted('log')).toHaveLength(1)
  })

  it('puts the sparkline inside the detail link and renders its controls as visible buttons', async () => {
    const wrapper = await mountSuspended(BodyMetricCard, {
      props: { metric: { type, latest: null, previous: null, goal: null, sparkline: [] }, menuItems: [{ label: 'Hide' }] },
      slots: { spark: () => h('span', { 'data-test': 'spark-content' }) }
    })
    expect(wrapper.find('a[data-test="metric-link-1"] [data-test="spark-content"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="metric-log-1"]').attributes('class')).toContain('ring-inset')
    expect(wrapper.find('[data-test="metric-log-1"]').attributes('class')).toContain('bg-primary/10')
    expect(wrapper.find('[data-test="metric-menu-1"]').attributes('class')).toContain('ring-inset')
  })
})
