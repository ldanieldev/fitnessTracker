import { describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
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

  it('takes a distance goal in miles and saves metres', async () => {
    let body: { targetValue?: number } = {}
    registerEndpoint('/api/workouts/exercises/3/goal', { method: 'PUT', handler: async (event) => {
      body = await readBody(event)
      return { ok: true }
    } })
    const wrapper = await mountSuspended(WorkoutGoalSheet, { attachTo: document.body, props: { ...base, metric: 'distance', unit: 'm' } })
    await flushPromises()
    expect(new DOMWrapper(document.body).text()).toContain('Target (mi)')
    await find('input[data-test="goal-target"]').setValue('13.1')
    await find('[data-test="goal-save"]').trigger('click')
    await flushPromises()
    expect(body.targetValue).toBe(21082.41)
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('shows and takes a pace goal as minutes per mile', async () => {
    let body: { targetValue?: number } = {}
    registerEndpoint('/api/workouts/exercises/3/goal', { method: 'PUT', handler: async (event) => {
      body = await readBody(event)
      return { ok: true }
    } })
    const goal = { exerciseId: 3, metric: 'pace' as const, targetValue: 1609.344 / 480, targetReps: null, targetDate: null, achievedAt: null }
    const wrapper = await mountSuspended(WorkoutGoalSheet, {
      attachTo: document.body, props: { ...base, metric: 'pace', unit: 'm/s', goal }
    })
    await flushPromises()
    expect(new DOMWrapper(document.body).text()).toContain('Target (min/mi)')
    expect((find('input[data-test="goal-target"]').element as HTMLInputElement).value).toBe('8:00')
    await find('input[data-test="goal-target"]').setValue('7:30')
    await find('[data-test="goal-save"]').trigger('click')
    await flushPromises()
    expect(body.targetValue).toBeCloseTo(1609.344 / 450, 6)
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('takes a duration goal as m:ss and saves seconds', async () => {
    let body: { targetValue?: number } = {}
    registerEndpoint('/api/workouts/exercises/3/goal', { method: 'PUT', handler: async (event) => {
      body = await readBody(event)
      return { ok: true }
    } })
    const wrapper = await mountSuspended(WorkoutGoalSheet, { attachTo: document.body, props: { ...base, metric: 'duration', unit: 's' } })
    await flushPromises()
    await find('input[data-test="goal-target"]').setValue('2000')
    await find('[data-test="goal-save"]').trigger('click')
    await flushPromises()
    expect(body.targetValue).toBe(1200)
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('saves an unedited distance goal exactly', async () => {
    let body: { targetValue?: number } = {}
    registerEndpoint('/api/workouts/exercises/3/goal', { method: 'PUT', handler: async (event) => {
      body = await readBody(event)
      return { ok: true }
    } })
    const goal = { exerciseId: 3, metric: 'distance' as const, targetValue: 5000, targetReps: null, targetDate: null, achievedAt: null }
    const wrapper = await mountSuspended(WorkoutGoalSheet, { attachTo: document.body, props: { ...base, metric: 'distance', unit: 'm', goal } })
    await flushPromises()
    await find('[data-test="goal-save"]').trigger('click')
    await flushPromises()
    expect(body.targetValue).toBe(5000)
    wrapper.unmount()
    document.body.innerHTML = ''
  })
  it.each([
    { metric: 'pace' as const, unit: 'm/s', targetValue: 3.1 },
    { metric: 'duration' as const, unit: 's', targetValue: 1234.5 }
  ])('saves an unedited $metric goal exactly, even after focus and blur', async ({ metric, unit, targetValue }) => {
    let body: { targetValue?: number } = {}
    registerEndpoint('/api/workouts/exercises/3/goal', { method: 'PUT', handler: async (event) => {
      body = await readBody(event)
      return { ok: true }
    } })
    const goal = { exerciseId: 3, metric, targetValue, targetReps: null, targetDate: null, achievedAt: null }
    const wrapper = await mountSuspended(WorkoutGoalSheet, { attachTo: document.body, props: { ...base, metric, unit, goal } })
    await flushPromises()
    const input = find('input[data-test="goal-target"]')
    await input.trigger('focus')
    await input.trigger('blur')
    await find('[data-test="goal-save"]').trigger('click')
    await flushPromises()
    expect(body.targetValue).toBe(targetValue)
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
