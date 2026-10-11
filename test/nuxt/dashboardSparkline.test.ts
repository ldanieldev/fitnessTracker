import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DashboardSparkline from '../../app/components/dashboard/DashboardSparkline.vue'

describe('DashboardSparkline', () => {
  it('fills its container by default', async () => {
    const wrapper = await mountSuspended(DashboardSparkline, { props: { values: [1, 2] } })
    expect(wrapper.get('svg').classes()).toEqual(expect.arrayContaining(['h-8', 'w-full']))
  })

  it('renders a fixed inline size without the full-width class', async () => {
    const wrapper = await mountSuspended(DashboardSparkline, { props: { values: [1, 2], size: 'inline' } })
    const classes = wrapper.get('svg').classes()
    expect(classes).toEqual(expect.arrayContaining(['h-5', 'w-16', 'shrink-0']))
    expect(classes).not.toContain('w-full')
  })

  it('draws nothing for a single value or for no values with a goal', async () => {
    expect((await mountSuspended(DashboardSparkline, { props: { values: [5] } })).find('svg').exists()).toBe(false)
    const empty = await mountSuspended(DashboardSparkline, { props: { values: [], goal: 180 } })
    expect(empty.find('svg').exists()).toBe(false)
  })

  it('draws a flat line for equal values', async () => {
    const wrapper = await mountSuspended(DashboardSparkline, { props: { values: [7, 7, 7] } })
    const d = wrapper.get('path').attributes('d')!
    expect(d).not.toContain('NaN')
    const ys = [...d.matchAll(/[ML]\s*[\d.]+[ ,]([\d.]+)/g)].map((m) => m[1])
    expect(ys.length).toBe(3)
    expect(new Set(ys).size).toBe(1)
  })
})
