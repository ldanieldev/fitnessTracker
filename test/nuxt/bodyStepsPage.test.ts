import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { getQuery, type H3Event } from 'h3'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import { useToday } from '../../app/composables/useToday'
import StepsPage from '../../app/pages/body/steps.vue'
import { shiftDate } from '../../shared/utils/nutritionSummary'
import { summarizeWeek } from '../../shared/utils/steps'

mockNuxtImport('useUserSession', () => () => ({
  loggedIn: { value: true },
  user: { value: { id: 1, weekStart: 0 } },
  fetch: vi.fn(),
  clear: vi.fn()
}))

const TODAY = '2026-10-07'
const THIS_WEEK = '2026-10-04'
const eight = [{ dailyTarget: 8000, effectiveFrom: '2026-01-01' }]
const calls: number[] = []

registerEndpoint('/api/body/steps/weeks', (event: H3Event) => {
  const count = Number(getQuery(event).count)
  calls.push(count)
  return Array.from({ length: count }, (_, i) => {
    const start = shiftDate(THIS_WEEK, -7 * i)
    return summarizeWeek(start, i === 0 ? [{ date: start, steps: 5000 }] : [], eight, TODAY)
  })
})
registerEndpoint('/api/body/steps/target', () => ({ target: eight[0] }))

afterEach(() => {
  calls.length = 0
  clearNuxtData()
  document.body.innerHTML = ''
})

describe('body/steps page', () => {
  it('Load more fetches the next 26 weeks, grows the history and keeps the button', async () => {
    useToday().value = TODAY
    const wrapper = await mountSuspended(StepsPage, { route: '/body/steps' })
    await flushPromises()
    expect(wrapper.findAll('[data-test^="steps-history-"]')).toHaveLength(25)

    await wrapper.find('[data-test="steps-load-more"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('[data-test^="steps-history-"]')).toHaveLength(51))
    expect(calls).toContain(52)
    expect(wrapper.find('[data-test="steps-load-more"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows the hero, last week on the chart, avg/best tiles, and opens the right sheets', async () => {
    useToday().value = TODAY
    const wrapper = await mountSuspended(StepsPage, { route: '/body/steps', attachTo: document.body })
    await flushPromises()
    expect(wrapper.find('[data-test="steps-hero-total"]').text()).toBe('5,000')
    expect(wrapper.find('[data-test="steps-last-week"]').text()).toBe('—')
    expect(wrapper.find('[data-test="tile-avg"]').text()).toContain('5,000')
    expect(wrapper.find('[data-test="tile-best"]').text()).toContain('5,000')

    const tile = wrapper.find('[data-test="tile-target"]')
    expect(tile.text()).toContain('8,000')
    await tile.trigger('click')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Steps target'))

    await wrapper.find('[data-test="steps-hero-log"]').trigger('click')
    await vi.waitFor(() => expect(document.body.textContent).toContain('Log steps'))
    expect((document.querySelector('input[data-test="steps-date"]') as HTMLInputElement).value).toBe(TODAY)
    expect(wrapper.find('[data-test="steps-log"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
