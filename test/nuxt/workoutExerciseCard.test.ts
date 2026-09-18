import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutExerciseCard from '../../app/components/workout/WorkoutExerciseCard.vue'

const entry = {
  id: 9,
  exerciseId: 7,
  exerciseName: 'Barbell Bench Press',
  sortOrder: 0,
  trackingType: 'weight_reps' as const,
  loadStyle: 'barbell' as const,
  barWeight: 45,
  weightIncrement: 5,
  notes: null,
  sets: [
    { id: 1, sortOrder: 0, weight: 185, reps: 8, distanceMeters: null, durationSeconds: null,
      done: true, comment: null, records: [] }
  ],
  lastSets: [{ weight: 175, reps: 8 }, { weight: 175, reps: 6 }]
}

describe('WorkoutExerciseCard', () => {
  it('names the exercise, links to it, and lists its sets plus an empty next row', async () => {
    const wrapper = await mountSuspended(WorkoutExerciseCard, { props: { entry, isFirst: true, isLast: false } })
    expect(wrapper.text()).toContain('Barbell Bench Press')
    expect(wrapper.find('a[data-test="entry-link-9"]').attributes('href')).toBe('/workouts/exercises/7')
    expect(wrapper.findAll('[data-test="set-row"]')).toHaveLength(2)
  })

  it('prefills the next row from the last set logged today', async () => {
    const wrapper = await mountSuspended(WorkoutExerciseCard, { props: { entry, isFirst: true, isLast: false } })
    expect((wrapper.find('[data-test="set-weight-new"]').element as HTMLInputElement).value).toBe('185')
  })

  it('prefills from the previous session when nothing is logged yet', async () => {
    const empty = { ...entry, sets: [] }
    const wrapper = await mountSuspended(WorkoutExerciseCard, { props: { entry: empty, isFirst: true, isLast: false } })
    expect((wrapper.find('[data-test="set-weight-new"]').element as HTMLInputElement).value).toBe('175')
    expect((wrapper.find('[data-test="set-reps-new"]').element as HTMLInputElement).value).toBe('6')
  })

  it('disables moving up on the first card and moving down on the last', async () => {
    const first = await mountSuspended(WorkoutExerciseCard, { props: { entry, isFirst: true, isLast: false } })
    expect(first.find('[data-test="entry-up-9"]').attributes('disabled')).toBeDefined()
    expect(first.find('[data-test="entry-down-9"]').attributes('disabled')).toBeUndefined()
    const last = await mountSuspended(WorkoutExerciseCard, { props: { entry, isFirst: false, isLast: true } })
    expect(last.find('[data-test="entry-down-9"]').attributes('disabled')).toBeDefined()
  })

  it('emits addSet from the next row and remove from the card menu', async () => {
    const wrapper = await mountSuspended(WorkoutExerciseCard, { props: { entry, isFirst: true, isLast: false } })
    await wrapper.find('[data-test="set-save-new"]').trigger('click')
    expect(wrapper.emitted('addSet')![0]![0]).toMatchObject({ weight: 185, reps: 8 })
    await wrapper.find('[data-test="entry-remove-9"]').trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('shows a failed save beside the set it belongs to and retries that set', async () => {
    const wrapper = await mountSuspended(WorkoutExerciseCard, {
      props: { entry, isFirst: true, isLast: false, saveErrors: { 1: 'Server exploded' } }
    })
    const rows = wrapper.findAll('[data-test="set-row"]')
    expect(rows[0]!.find('[data-test="set-save-error-1"]').text()).toContain('Server exploded')
    expect(rows[1]!.find('[data-test="set-save-error-new"]').exists()).toBe(false)
    await wrapper.find('[data-test="set-retry-1"]').trigger('click')
    expect(wrapper.emitted('retrySave')).toEqual([[1]])
  })

  it('summarises every set from last time under the exercise name, and omits the line without one', async () => {
    const wrapper = await mountSuspended(WorkoutExerciseCard, { props: { entry, isFirst: true, isLast: false } })
    const last = wrapper.find('[data-test="entry-last-9"]')
    expect(last.text()).toContain('Last time:')
    expect(last.findAll('[data-test="entry-last-set"]').map((s) => s.text())).toEqual(['175 lb × 8', '175 lb × 6'])

    const noHistory = await mountSuspended(WorkoutExerciseCard, {
      props: { entry: { ...entry, lastSets: [] }, isFirst: true, isLast: false }
    })
    expect(noHistory.find('[data-test="entry-last-9"]').exists()).toBe(false)
  })

  it('shows a failed add beside the next row and retries it with no set id', async () => {
    const wrapper = await mountSuspended(WorkoutExerciseCard, {
      props: { entry, isFirst: true, isLast: false, saveErrors: { new: 'Server exploded' } }
    })
    const rows = wrapper.findAll('[data-test="set-row"]')
    expect(rows[0]!.find('[data-test="set-save-error-1"]').exists()).toBe(false)
    expect(rows[1]!.find('[data-test="set-save-error-new"]').text()).toContain('Server exploded')
    await wrapper.find('[data-test="set-retry-new"]').trigger('click')
    expect(wrapper.emitted('retrySave')).toEqual([[null]])
  })
})
