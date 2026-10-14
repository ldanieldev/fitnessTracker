import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppLineChart from '../../app/components/AppLineChart.vue'

const props = {
  points: [
    { date: '2026-03-01', value: 185 },
    { date: '2026-03-08', value: 205 }
  ],
  trend: [],
  goal: null,
  from: '2026-03-01',
  to: '2026-03-31',
  gapDays: 21,
  summary: 'Bench: 2 sessions',
  emptyText: 'Nothing here'
}

interface TooltipProps {
  dot: { value: number }
  previous: { value: number } | null
  when: string
}

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
    expect(wrapper.findAll('path[fill^="url("]').map((p) => p.attributes('fill'))).toEqual(
      ids.map((id) => `url(#${id})`)
    )
  })

  it('flags noted days on the baseline and shows the note in the tooltip', async () => {
    const markers = [
      { date: '2026-03-08', label: 'Event day, ate out' },
      { date: '2026-03-31', label: 'Poor sleep' },
      { date: '2026-04-02', label: 'Outside the range' }
    ]
    const wrapper = await mountSuspended(AppLineChart, {
      props: { ...props, markers },
      slots: { tooltip: ({ dot, when }: TooltipProps) => `${when}: ${dot.value}` }
    })
    expect(wrapper.findAll('[data-test^="chart-marker-"]').map((m) => m.attributes('data-test'))).toEqual([
      'chart-marker-2026-03-08',
      'chart-marker-2026-03-31'
    ])
    expect(wrapper.find('ul.sr-only').text()).toContain('Note, Mar 31: Poor sleep')

    await wrapper.find('rect').trigger('pointerdown', { clientX: 5000 })
    expect(wrapper.find('[data-test="chart-tooltip"]').text()).toContain('Mar 31')
    expect(wrapper.find('[data-test="chart-note"]').text()).toBe('Poor sleep')

    await wrapper.find('rect').trigger('pointerdown', { clientX: 0 })
    expect(wrapper.find('[data-test="chart-tooltip"]').text()).toBe('Mar 1: 185')
    expect(wrapper.find('[data-test="chart-note"]').exists()).toBe(false)
  })
})
