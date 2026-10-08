import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutToolsOneRepMax from '../../app/components/workout/WorkoutToolsOneRepMax.vue'

const blank = { weight: null, reps: null }
const found = { estimate: 253.1, source: { weight: 225, reps: 5, performedOn: '2026-09-02' }, assisted: false }

describe('WorkoutToolsOneRepMax', () => {
  it('shows a skeleton while loading', async () => {
    const wrapper = await mountSuspended(WorkoutToolsOneRepMax, {
      props: { result: null, pending: true, failed: false, hasExercise: true, override: blank }
    })
    expect(wrapper.find('[data-test="one-rep-max-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="one-rep-max-estimate"]').exists()).toBe(false)
  })

  it('shows only the skeleton while a Retry is loading, not the error row with it', async () => {
    const wrapper = await mountSuspended(WorkoutToolsOneRepMax, {
      props: { result: null, pending: true, failed: true, hasExercise: true, override: blank }
    })
    expect(wrapper.find('[data-test="one-rep-max-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="one-rep-max-error"]').exists()).toBe(false)
  })

  it('shows the estimate, its source and the rep-max table', async () => {
    const wrapper = await mountSuspended(WorkoutToolsOneRepMax, {
      props: { result: found, pending: false, failed: false, hasExercise: true, override: blank }
    })
    expect(wrapper.find('[data-test="one-rep-max-estimate"]').text()).toContain('253.1')
    expect(wrapper.find('[data-test="one-rep-max-source"]').text()).toContain('225×5')
    expect(wrapper.find('[data-test="one-rep-max-source"]').text()).toContain('Sep 2')
    expect(wrapper.find('[data-test="rm-row-5"]').text()).toContain('225')
    expect(wrapper.findAll('[data-test^="rm-row-"]')).toHaveLength(15)
  })

  it('lets a complete override replace the estimate', async () => {
    const wrapper = await mountSuspended(WorkoutToolsOneRepMax, {
      props: { result: found, pending: false, failed: false, hasExercise: true, override: { weight: 200, reps: 3 } }
    })
    expect(wrapper.find('[data-test="one-rep-max-estimate"]').text()).toContain('211.8')
    expect(wrapper.find('[data-test="one-rep-max-source"]').text()).toContain('your numbers')
  })

  it('explains an empty history, an assisted exercise and a failed load', async () => {
    const empty = await mountSuspended(WorkoutToolsOneRepMax, {
      props: { result: { estimate: null, source: null, assisted: false }, pending: false, failed: false, hasExercise: true, override: blank }
    })
    expect(empty.find('[data-test="one-rep-max-empty"]').text()).toContain('1–10 reps in the last 90 days')
    const assisted = await mountSuspended(WorkoutToolsOneRepMax, {
      props: { result: { estimate: null, source: null, assisted: true }, pending: false, failed: false, hasExercise: true, override: blank }
    })
    expect(assisted.find('[data-test="one-rep-max-assisted"]').exists()).toBe(true)
    const failed = await mountSuspended(WorkoutToolsOneRepMax, {
      props: { result: null, pending: false, failed: true, hasExercise: true, override: blank }
    })
    await failed.find('[data-test="one-rep-max-retry"]').trigger('click')
    expect(failed.emitted('retry')).toHaveLength(1)
  })

  it('tells "no exercise" apart from "no recent sets"', async () => {
    const wrapper = await mountSuspended(WorkoutToolsOneRepMax, {
      props: { result: null, pending: false, failed: false, hasExercise: false, override: blank }
    })
    expect(wrapper.find('[data-test="one-rep-max-no-exercise"]').text()).toBe('Enter a set to estimate your 1RM.')
    expect(wrapper.find('[data-test="one-rep-max-empty"]').exists()).toBe(false)
  })

  it('keeps both override fields when weight and reps change before the parent re-renders', async () => {
    const updates: unknown[] = []
    const wrapper = await mountSuspended(WorkoutToolsOneRepMax, {
      props: {
        result: found, pending: false, failed: false, hasExercise: true, override: blank,
        'onUpdate:override': (value: unknown) => updates.push(value)
      }
    })
    const [weight, reps] = wrapper.findAllComponents({ name: 'AppNumberInput' })
    weight!.vm.$emit('update:modelValue', 200)
    reps!.vm.$emit('update:modelValue', 3)
    expect(updates.at(-1)).toEqual({ weight: 200, reps: 3 })
  })

  it('keeps Retry reachable while an override shows an estimate', async () => {
    const wrapper = await mountSuspended(WorkoutToolsOneRepMax, {
      props: { result: null, pending: false, failed: true, hasExercise: true, override: { weight: 200, reps: 3 } }
    })
    expect(wrapper.find('[data-test="one-rep-max-estimate"]').text()).toContain('211.8')
    await wrapper.find('[data-test="one-rep-max-retry"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('shows a failed load without an empty-history line', async () => {
    const wrapper = await mountSuspended(WorkoutToolsOneRepMax, {
      props: { result: null, pending: false, failed: true, hasExercise: true, override: blank }
    })
    expect(wrapper.find('[data-test="one-rep-max-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="one-rep-max-empty"]').exists()).toBe(false)
  })

  it('keeps the last estimate on screen while it refreshes', async () => {
    const wrapper = await mountSuspended(WorkoutToolsOneRepMax, {
      props: { result: found, pending: true, failed: false, hasExercise: true, override: blank }
    })
    expect(wrapper.find('[data-test="one-rep-max-skeleton"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="one-rep-max-estimate"]').text()).toContain('253.1')
  })
})
