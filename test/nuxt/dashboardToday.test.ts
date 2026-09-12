import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { todayDate } from '../../shared/utils/nutritionSummary'
import DashboardToday from '../../app/components/dashboard/DashboardToday.vue'

describe('DashboardToday', () => {
  it('renders today\'s remaining calories and links to the diary', async () => {
    registerEndpoint(`/api/nutrition/diary/${todayDate()}`, () => ({
      date: todayDate(), persisted: true, notes: null, goalProfileId: 1,
      targets: [{ key: 'energy', name: 'Calories', unit: 'kcal', amount: 1900, direction: 'max' }],
      containers: [], entries: [], totals: { energy: 1463 }
    }))
    registerEndpoint('/api/nutrition/nutrients/tracked', () => [{ key: 'energy', name: 'Calories', unit: 'kcal', sortOrder: 0 }])
    registerEndpoint('/api/nutrition/goal-profiles', () => [{ id: 1, name: 'cut1', isDefault: true, inputMode: 'grams', calories: null, targets: [] }])
    const wrapper = await mountSuspended(DashboardToday)
    await new Promise((r) => setTimeout(r, 0))
    expect(wrapper.find('[data-test="energy-value"]').text()).toBe('437')
    expect(wrapper.find('a[data-test="dashboard-today"]').attributes('href')).toBe('/diary/today')
  })
})
