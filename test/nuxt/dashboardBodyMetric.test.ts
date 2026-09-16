import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import DashboardBodyMetric from '../../app/components/dashboard/DashboardBodyMetric.vue'

const type = (id: number, key: string) => ({ id, key, name: key, unit: 'lbs', precision: 1, direction: 'neutral', builtIn: true, hidden: false, sortOrder: null })

describe('DashboardBodyMetric', () => {
  it('prefers bodyweight, shows its latest value and delta, and links to its page', async () => {
    registerEndpoint('/api/body/overview', () => [
      { type: type(2, 'waist'), latest: { id: 1, typeId: 2, value: 34, measuredAt: '2026-09-15T08:00:00.000Z', measuredOn: '2026-09-15' }, previous: null, goal: null, sparkline: [] },
      { type: type(1, 'bodyweight'), latest: { id: 2, typeId: 1, value: 197, measuredAt: '2026-09-15T08:00:00.000Z', measuredOn: '2026-09-15' }, previous: { id: 3, typeId: 1, value: 198.8, measuredAt: '2026-09-10T08:00:00.000Z', measuredOn: '2026-09-10' }, goal: null, sparkline: [] }
    ])
    const wrapper = await mountSuspended(DashboardBodyMetric)
    expect(wrapper.find('[data-test="dashboard-body"] [data-test="metric-latest-1"]').text()).toBe('197.0')
    expect(wrapper.text()).toContain('-1.8')
    expect(wrapper.find('a[data-test="metric-link-1"]').attributes('href')).toBe('/body/1')
  })
})
