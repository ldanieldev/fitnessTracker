import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BodyGoalCard from '../../app/components/body/BodyGoalCard.vue'

const type = { id: 1, key: 'bodyweight', name: 'Bodyweight', unit: 'lbs', precision: 1, direction: 'neutral' as const, builtIn: true, hidden: false, sortOrder: null }

describe('BodyGoalCard', () => {
  it('shows progress, the amount to go, and the needed weekly pace for a dated goal', async () => {
    const wrapper = await mountSuspended(BodyGoalCard, {
      props: {
        today: '2026-09-16',
        item: {
          type,
          goal: { typeId: 1, targetValue: 185, targetDate: '2026-12-16', startValue: 200, startDate: '2026-09-01' },
          latest: { id: 5, typeId: 1, value: 197, measuredAt: '2026-09-15T08:00:00.000Z', measuredOn: '2026-09-15' }
        }
      }
    })
    expect(wrapper.find('[data-test="goal-remaining-1"]').text()).toContain('12.0 lbs to go')
    expect(wrapper.find('[data-test="goal-pace-1"]').text()).toMatch(/needs -0\.9 lbs\/wk/)
    expect(wrapper.text()).toContain('Dec 16')
    expect(wrapper.find('[data-test="goal-progress-1"]').exists()).toBe(true)
    expect(wrapper.find('a').attributes('href')).toBe('/body/1')
    expect(wrapper.find('[data-test="goal-edit-1"]').attributes('class')).toContain('ring-inset')
  })

  it('says reached and omits pace when there is no date', async () => {
    const wrapper = await mountSuspended(BodyGoalCard, {
      props: {
        today: '2026-09-16',
        item: {
          type,
          goal: { typeId: 1, targetValue: 185, targetDate: null, startValue: 200, startDate: '2026-09-01' },
          latest: { id: 5, typeId: 1, value: 184.5, measuredAt: '2026-09-15T08:00:00.000Z', measuredOn: '2026-09-15' }
        }
      }
    })
    expect(wrapper.find('[data-test="goal-remaining-1"]').text()).toContain('Reached')
    expect(wrapper.find('[data-test="goal-pace-1"]').text()).toContain('No target date')
  })
})
