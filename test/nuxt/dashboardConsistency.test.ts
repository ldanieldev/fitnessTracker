import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import DashboardConsistency from '../../app/components/dashboard/DashboardConsistency.vue'
import type { Consistency } from '../../shared/types/dashboard'
import { calendarWeekStarts } from '../../shared/utils/dashboard'
import { todayDate } from '../../shared/utils/nutritionSummary'

let payload: Consistency | null = null
let fail = false
registerEndpoint('/api/dashboard/consistency', () => {
  if (fail) throw new Error('boom')
  return payload
})

afterEach(() => {
  clearNuxtData('dashboard:consistency')
  fail = false
})

const today = todayDate()
const weeks = calendarWeekStarts(today, 0).map((start, i) => ({
  start,
  target: 3,
  count: i === 11 ? 1 : 3,
  met: i < 9 ? null : i === 11 ? null : true
}))
const base: Consistency = {
  weekStart: 0,
  weeks,
  days: [today],
  streak: 2,
  best: 5,
  thisWeek: { count: 1, target: 3 },
  targetSource: 'setting'
}

async function mounted() {
  const wrapper = await mountSuspended(DashboardConsistency)
  await flushPromises()
  return wrapper
}

describe('DashboardConsistency', () => {
  it('shows the streak, the week progress and the calendar', async () => {
    payload = base
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="consistency-streak"]').text()).toBe('2')
    expect(wrapper.find('[data-test="card-aside"]').text()).toBe('1 / 3 this week')
    expect(wrapper.find('[data-test="consistency-target"]').text()).toBe('best 5 · target 3/wk (setting)')
    expect(wrapper.findAll('[data-hit="true"]')).toHaveLength(1)
  })

  it('names the program as the target source and handles a rest week', async () => {
    payload = { ...base, targetSource: 'program', thisWeek: { count: 0, target: 0 } }
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="card-aside"]').text()).toBe('Rest week')
    expect(wrapper.find('[data-test="consistency-target"]').text()).toBe('best 5 · program rest week')
    clearNuxtData('dashboard:consistency')
    payload = { ...base, targetSource: 'program', thisWeek: { count: 1, target: 4 } }
    const program = await mounted()
    expect(program.find('[data-test="consistency-target"]').text()).toBe('best 5 · target 4/wk (program)')
  })

  it('retries after an error', async () => {
    fail = true
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="dashboard-retry"]').text()).toContain('Couldn’t load consistency')
    fail = false
    payload = base
    await wrapper.find('[data-test="dashboard-retry"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="consistency-streak"]').exists()).toBe(true)
  })

  it('shows a calendar-shaped skeleton while loading', async () => {
    const wrapper = await mountSuspended(DashboardConsistency)
    expect(wrapper.find('[data-test="calendar"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-met]')).toHaveLength(12)
    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
    expect(wrapper.find('[data-test="consistency-streak"]').exists()).toBe(false)
    await flushPromises()
  })

  it('renders nothing when the module is hidden', async () => {
    payload = null
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="dashboard-consistency"]').exists()).toBe(false)
  })
})
