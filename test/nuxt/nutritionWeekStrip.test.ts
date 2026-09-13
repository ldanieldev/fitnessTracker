import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NutritionWeekStrip from '../../app/components/nutrition/NutritionWeekStrip.vue'

describe('NutritionWeekStrip', () => {
  it('renders the week, marks logged days, and navigates on tap', async () => {
    const wrapper = await mountSuspended(NutritionWeekStrip, { props: { date: '2026-09-10', logged: ['2026-09-08'], weekStart: 1 } })
    expect(wrapper.findAll('[data-test^="week-day-"]')).toHaveLength(7)
    expect(wrapper.find('[data-test="week-day-2026-09-10"]').attributes('aria-current')).toBe('date')
    expect(wrapper.find('[data-test="week-day-2026-09-08"] [data-test="logged-dot"]').exists()).toBe(true)
    await wrapper.find('[data-test="week-day-2026-09-12"]').trigger('click')
    expect(wrapper.emitted('navigate')?.[0]).toEqual(['2026-09-12'])
    await wrapper.find('[data-test="week-next"]').trigger('click')
    expect(wrapper.emitted('navigate')?.[1]).toEqual(['2026-09-17'])
  })
})
