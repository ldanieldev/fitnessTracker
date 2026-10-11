import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import DashboardNutritionStreak from '../../app/components/dashboard/DashboardNutritionStreak.vue'
import type { NutritionStreak } from '../../shared/types/dashboard'
import { todayDate } from '../../shared/utils/nutritionSummary'

let payload: NutritionStreak | null = null
let fail = false
registerEndpoint('/api/dashboard/nutrition', () => {
  if (fail) throw new Error('boom')
  return payload
})

afterEach(() => {
  clearNuxtData('dashboard:nutrition')
  fail = false
})

const today = todayDate()

async function mounted() {
  const wrapper = await mountSuspended(DashboardNutritionStreak)
  await flushPromises()
  return wrapper
}

describe('DashboardNutritionStreak', () => {
  it('shows the streak, best, last week and the calendar', async () => {
    payload = { weekStart: 0, days: [today], streak: 12, best: 19, lastWeek: 6 }
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="nutrition-streak"]').text()).toBe('12')
    expect(wrapper.find('[data-test="nutrition-best"]').text()).toBe('best 19')
    expect(wrapper.find('[data-test="card-aside"]').text()).toBe('6 / 7 last week')
    expect(wrapper.findAll('[data-hit="true"]')).toHaveLength(1)
  })

  it('shows zeros for a new user', async () => {
    payload = { weekStart: 1, days: [], streak: 0, best: 0, lastWeek: 0 }
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="nutrition-streak"]').text()).toBe('0')
    expect(wrapper.findAll('[data-hit="true"]')).toHaveLength(0)
  })

  it('retries after an error', async () => {
    fail = true
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="dashboard-retry"]').text()).toContain('Couldn’t load nutrition')
    fail = false
    payload = { weekStart: 0, days: [], streak: 1, best: 1, lastWeek: 0 }
    await wrapper.find('[data-test="dashboard-retry"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="nutrition-streak"]').text()).toBe('1')
  })

  it('shows a calendar-shaped skeleton while loading', async () => {
    const wrapper = await mountSuspended(DashboardNutritionStreak)
    expect(wrapper.find('[data-test="calendar"]').exists()).toBe(true)
    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
    expect(wrapper.find('[data-test="nutrition-streak"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-met]')).toHaveLength(0)
    await flushPromises()
  })

  it('renders nothing when the module is hidden', async () => {
    payload = null
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="dashboard-nutrition"]').exists()).toBe(false)
  })
})
