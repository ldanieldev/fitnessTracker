import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BodyMetricChart from '../../app/components/body/BodyMetricChart.vue'

const base = { trend: [], goal: null, from: '2026-03-01', to: '2026-03-31', precision: 1, unit: 'lbs', granularity: 'day' as const }

describe('BodyMetricChart', () => {
  it('renders the raw path, breaks it across a gap, and labels itself for screen readers', async () => {
    const wrapper = await mountSuspended(BodyMetricChart, {
      props: { ...base, points: [{ date: '2026-03-01', value: 200 }, { date: '2026-03-02', value: 199.5 }, { date: '2026-03-30', value: 197 }] }
    })
    const raw = wrapper.find('[data-test="raw-path"]').attributes('d')!
    expect(raw.match(/M/g)).toHaveLength(2)
    expect(wrapper.find('[data-test="goal-line"]').exists()).toBe(false)
    expect(wrapper.find('svg').attributes('aria-label')).toContain('latest 197.0 lbs')
    expect(wrapper.find('svg').attributes('aria-label')).toContain('change -3.0 lbs')
  })

  it('draws the goal line and the trend when given', async () => {
    const wrapper = await mountSuspended(BodyMetricChart, {
      props: { ...base, goal: 185, points: [{ date: '2026-03-01', value: 200 }, { date: '2026-03-02', value: 199 }], trend: [{ date: '2026-03-02', value: 199.5 }] }
    })
    expect(wrapper.find('[data-test="goal-line"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="trend-path"]').exists()).toBe(true)
  })

  it('says so when there is nothing to plot', async () => {
    const wrapper = await mountSuspended(BodyMetricChart, { props: { ...base, points: [] } })
    expect(wrapper.text()).toContain('No readings in this range')
    expect(wrapper.find('[data-test="raw-path"]').exists()).toBe(false)
  })
})
