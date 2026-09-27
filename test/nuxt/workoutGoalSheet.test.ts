import { describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutGoalSheet from '../../app/components/workout/WorkoutGoalSheet.vue'

const base = { exerciseId: 3, metric: 'max_weight' as const, reps: null, unit: 'lb', goal: null, open: true }

// AppSheet teleports its body out of the mounted subtree, so query the attached document instead of wrapper.find.
function find(selector: string) {
  return new DOMWrapper(document.querySelector(selector))
}

describe('WorkoutGoalSheet', () => {
  it('refuses a target that is not a positive number', async () => {
    const wrapper = await mountSuspended(WorkoutGoalSheet, { attachTo: document.body, props: base })
    await flushPromises()
    await find('[data-test="goal-save"]').trigger('click')
    expect(new DOMWrapper(document.body).text()).toContain('Enter a target above zero')
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('shows the current goal and offers to remove it', async () => {
    const goal = {
      exerciseId: 3,
      metric: 'max_weight' as const,
      targetValue: 225,
      targetReps: null,
      targetDate: '2026-12-31',
      achievedAt: null
    }
    const wrapper = await mountSuspended(WorkoutGoalSheet, {
      attachTo: document.body,
      props: { ...base, goal }
    })
    await flushPromises()
    expect(find('[data-test="goal-remove"]').exists()).toBe(true)
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
