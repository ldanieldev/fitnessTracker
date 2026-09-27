import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ExerciseWorkoutPanel from '../../app/components/workout/ExerciseWorkoutPanel.vue'

const exercise = {
  id: 7,
  name: 'Barbell Bench Press',
  category: { id: 1, key: 'chest', name: 'Chest', color: 'rose', sortOrder: 0, shared: true, hidden: false },
  trackingType: 'weight_reps' as const,
  loadStyle: 'barbell' as const,
  barWeight: 45,
  weightIncrement: null,
  restSeconds: null,
  plateSizes: null,
  difficulty: 'beginner' as const,
  equipment: ['barbell'],
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps'],
  images: [],
  notes: null,
  link: null,
  favorite: false,
  hidden: false,
  shared: true,
  overridden: { category: false, trackingType: false, loadStyle: false, barWeight: false },
  defaultGraph: null
}

describe('ExerciseWorkoutPanel', () => {
  it('explains that these settings override the profile defaults', async () => {
    const wrapper = await mountSuspended(ExerciseWorkoutPanel, { props: { exercise } })
    expect(wrapper.find('[data-test="workout-help"]').text()).toContain('override your defaults in Settings → Workout')
  })

  it('emits the changed rest time on save', async () => {
    const wrapper = await mountSuspended(ExerciseWorkoutPanel, { props: { exercise } })
    await wrapper.find('[data-test="setting-rest-seconds"]').setValue('180')
    await wrapper.find('[data-test="workout-save"]').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toMatchObject({ restSeconds: 180 })
  })

  it('emits no save when nothing changed', async () => {
    const wrapper = await mountSuspended(ExerciseWorkoutPanel, { props: { exercise } })
    await wrapper.find('[data-test="workout-save"]').trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('offers a reset once a field is overridden and emits the field name', async () => {
    const wrapper = await mountSuspended(ExerciseWorkoutPanel, {
      props: { exercise: { ...exercise, weightIncrement: 2.5 } }
    })
    await wrapper.find('[data-test="reset-weightIncrement"]').trigger('click')
    expect(wrapper.emitted('reset')).toEqual([['weightIncrement']])
  })

  it('shows the default plates and customises them into an override', async () => {
    const wrapper = await mountSuspended(ExerciseWorkoutPanel, { props: { exercise } })
    expect(wrapper.find('[data-test="setting-plates"]').text()).toContain('45 · 35 · 25 · 10 · 5 · 2.5')
    await wrapper.find('[data-test="plates-customise"]').trigger('click')
    await wrapper.find('[data-test="plate-chip-35"]').trigger('click')
    await wrapper.find('[data-test="workout-save"]').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toMatchObject({ plateSizes: [45, 25, 10, 5, 2.5] })
  })

  it('offers a plates reset only when the exercise has an override', async () => {
    const wrapper = await mountSuspended(ExerciseWorkoutPanel, {
      props: { exercise: { ...exercise, plateSizes: [55, 45] } }
    })
    await wrapper.find('[data-test="reset-plateSizes"]').trigger('click')
    expect(wrapper.emitted('reset')).toEqual([['plateSizes']])
  })

  it('hides plates for a non-barbell exercise', async () => {
    const wrapper = await mountSuspended(ExerciseWorkoutPanel, {
      props: { exercise: { ...exercise, loadStyle: 'plain', barWeight: null } }
    })
    expect(wrapper.find('[data-test="setting-plates"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="setting-rest-seconds"]').exists()).toBe(true)
  })
})
