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

  it('resets a saved plates override on the server', async () => {
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

  it('backs out of an unsaved customisation without a reset round trip', async () => {
    const wrapper = await mountSuspended(ExerciseWorkoutPanel, { props: { exercise } })
    await wrapper.find('[data-test="plates-customise"]').trigger('click')
    await wrapper.find('[data-test="reset-plateSizes"]').trigger('click')
    expect(wrapper.find('[data-test="plates-customise"]').exists()).toBe(true)
    expect(wrapper.emitted('reset')).toBeUndefined()
    await wrapper.find('[data-test="workout-save"]').trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('binds the increment and rest labels to their inputs', async () => {
    const wrapper = await mountSuspended(ExerciseWorkoutPanel, { props: { exercise } })
    const labelFor = (text: string) => wrapper.findAll('label').find((el) => el.text() === text)!
    const controlFor = (text: string) => wrapper.element.querySelector(`[id="${labelFor(text).attributes('for')}"]`)
    expect(controlFor('Weight increment')).toBe(wrapper.find('[data-test="setting-weight-increment"]').element)
    expect(controlFor('Rest (seconds)')).toBe(wrapper.find('[data-test="setting-rest-seconds"]').element)
    expect(labelFor('Rest (seconds)').classes()).toContain('text-dimmed')
  })

  it('groups the plates under a legend and names the reset by its visible text', async () => {
    const wrapper = await mountSuspended(ExerciseWorkoutPanel, {
      props: { exercise: { ...exercise, plateSizes: [55, 45] } }
    })
    const plates = wrapper.find('[data-test="setting-plates"]')
    expect(plates.element.tagName).toBe('FIELDSET')
    expect(plates.find('legend').text()).toBe('Plates')
    const reset = wrapper.find('[data-test="reset-plateSizes"]')
    expect(reset.attributes('aria-label')).toBeUndefined()
    expect(reset.attributes('aria-labelledby')).toBeUndefined()
    expect(reset.text()).toBe('Use default plates')
  })
})
