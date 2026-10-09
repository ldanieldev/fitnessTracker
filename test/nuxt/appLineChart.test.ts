import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppLineChart from '../../app/components/AppLineChart.vue'

const props = {
  points: [{ date: '2026-03-01', value: 185 }, { date: '2026-03-08', value: 205 }],
  trend: [],
  goal: null,
  from: '2026-03-01',
  to: '2026-03-31',
  gapDays: 21,
  summary: 'Bench: 2 sessions',
  emptyText: 'Nothing here'
}

interface TooltipProps { dot: { value: number }, previous: { value: number } | null, when: string }

describe('AppLineChart', () => {
  it('labels itself with the summary and shows the empty text only without points', async () => {
    const wrapper = await mountSuspended(AppLineChart, { props })
    expect(wrapper.find('svg').attributes('aria-label')).toBe('Bench: 2 sessions')
    expect(wrapper.text()).not.toContain('Nothing here')
    const empty = await mountSuspended(AppLineChart, { props: { ...props, points: [] } })
    expect(empty.text()).toContain('Nothing here')
  })

  it('fills the tooltip slot with the picked dot and the one before it', async () => {
    const wrapper = await mountSuspended(AppLineChart, {
      props,
      slots: {
        tooltip: ({ dot, previous, when }: TooltipProps) => `${when}: ${dot.value} after ${previous?.value ?? 'none'}`
      }
    })
    await wrapper.find('rect').trigger('pointerdown', { clientX: 400 })
    expect(wrapper.find('[data-test="chart-tooltip"]').text()).toBe('Mar 8: 205 after 185')
  })

  it('gives each chart on a page its own area gradient', async () => {
    const Pair = defineComponent({ render: () => [h(AppLineChart, props), h(AppLineChart, props)] })
    const wrapper = await mountSuspended(Pair)
    const ids = wrapper.findAll('linearGradient').map((g) => g.attributes('id'))
    expect(new Set(ids).size).toBe(2)
    expect(wrapper.findAll('path[fill^="url("]').map((p) => p.attributes('fill'))).toEqual(ids.map((id) => `url(#${id})`))
  })
})
