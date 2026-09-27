import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutMetricChart from '../../app/components/workout/WorkoutMetricChart.vue'

const base = {
  trend: [], goal: null, from: '2026-03-01', to: '2026-03-31', precision: 1, unit: 'lb', label: 'Max weight'
}

describe('WorkoutMetricChart', () => {
  it('plots the sessions and describes itself for screen readers', async () => {
    const wrapper = await mountSuspended(WorkoutMetricChart, {
      props: { ...base, points: [{ date: '2026-03-01', value: 185 }, { date: '2026-03-08', value: 205 }] }
    })
    expect(wrapper.find('[data-test="raw-path"]').exists()).toBe(true)
    expect(wrapper.find('svg').attributes('aria-label')).toContain('Max weight')
    expect(wrapper.find('svg').attributes('aria-label')).toContain('205.0 lb')
  })

  it('draws the goal line and the trend when given', async () => {
    const wrapper = await mountSuspended(WorkoutMetricChart, {
      props: {
        ...base,
        goal: 225,
        points: [{ date: '2026-03-01', value: 185 }, { date: '2026-03-08', value: 205 }],
        trend: [{ date: '2026-03-08', value: 195 }]
      }
    })
    expect(wrapper.find('[data-test="goal-line"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="trend-path"]').exists()).toBe(true)
  })

  it('breaks the line across a gap longer than three weeks', async () => {
    const wrapper = await mountSuspended(WorkoutMetricChart, {
      props: { ...base, points: [{ date: '2026-03-01', value: 185 }, { date: '2026-03-31', value: 205 }] }
    })
    expect(wrapper.find('[data-test="raw-path"]').attributes('d')!.match(/M/g)).toHaveLength(2)
  })

  it('says so when the range holds nothing', async () => {
    const wrapper = await mountSuspended(WorkoutMetricChart, { props: { ...base, points: [] } })
    expect(wrapper.text()).toContain('Nothing logged in this range')
  })
})
