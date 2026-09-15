import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { todayDate } from '../../shared/utils/nutritionSummary'
import { useToday } from '../../app/composables/useToday'
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
    // Production ordering: the component mounts while today is still null and the client plugin resolves it afterwards.
    const today = useToday()
    today.value = null
    const wrapper = await mountSuspended(DashboardToday)
    today.value = todayDate()
    await new Promise((r) => setTimeout(r, 20))
    expect(wrapper.find('[data-test="energy-value"]').text()).toBe('437')
    expect(wrapper.find('a[data-test="dashboard-today"]').attributes('href')).toBe('/diary/today')
  })
})
