import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutSetForm from '../../app/components/workout/WorkoutSetForm.vue'

const set = (id: number, weight: number | null, reps: number | null) => ({
  id, sortOrder: id, weight, reps, distanceMeters: null, durationSeconds: null, done: false, comment: null, records: []
})

const barbell = {
  id: 9, exerciseId: 7, exerciseName: 'Barbell Squat', sortOrder: 0, trackingType: 'weight_reps' as const,
  loadStyle: 'barbell' as const, barWeight: 45, weightIncrement: null, restSeconds: null,
  plateSizes: [55, 45, 35, 25, 10, 5, 2.5], notes: null, sets: [set(1, 175, 5)], lastSets: [{ weight: 165, reps: 5 }]
}

const input = (wrapper: Awaited<ReturnType<typeof mountSuspended>>, test: string) =>
  wrapper.find(`[data-test="${test}"]`).element as HTMLInputElement

describe('WorkoutSetForm', () => {
  it('numbers the set and prefills from the last set logged today', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: { entry: barbell } })
    expect(wrapper.find('[data-test="set-form-heading"]').text()).toBe('Set 2')
    expect(wrapper.findAll('[data-test="set-weight-new"]')).toHaveLength(1)
    expect(input(wrapper, 'set-weight-new').value).toBe('175')
    expect(input(wrapper, 'set-reps-new').value).toBe('5')
    expect(wrapper.text()).toContain('Weight (lb)')
    expect(wrapper.text()).not.toContain('LBS')
  })

  it('prefills from the previous session when nothing is logged yet', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: { entry: { ...barbell, sets: [] } } })
    expect(wrapper.find('[data-test="set-form-heading"]').text()).toBe('Set 1')
    expect(input(wrapper, 'set-weight-new').value).toBe('165')
  })

  it('re-seeds after a set is added', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: { entry: barbell } })
    await wrapper.setProps({ entry: { ...barbell, sets: [set(1, 175, 5), set(2, 205, 6)] } })
    expect(wrapper.find('[data-test="set-form-heading"]').text()).toBe('Set 3')
    expect(input(wrapper, 'set-weight-new').value).toBe('205')
    expect(input(wrapper, 'set-reps-new').value).toBe('6')
  })

  it('shows plate circles for a barbell exercise that follow the weight both ways', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: { entry: { ...barbell, sets: [set(1, 190, 5)] } } })
    expect(wrapper.find('[data-test="plate-count-55"]').text()).toBe('1')
    await wrapper.find('[data-test="plate-45"]').trigger('click')
    expect(input(wrapper, 'set-weight-new').value).toBe('280')
    await wrapper.find('[data-test="set-weight-new"]').setValue('135')
    expect(wrapper.find('[data-test="plate-count-45"]').text()).toBe('1')
    expect(wrapper.find('[data-test="plate-count-55"]').exists()).toBe(false)
  })

  it('shows no circles for a non-barbell exercise', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, {
      props: { entry: { ...barbell, loadStyle: 'plain' as const, barWeight: null, plateSizes: null } }
    })
    expect(wrapper.find('[data-test^="plate-"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-test="set-weight-new"]')).toHaveLength(1)
  })

  it('emits the typed values on Log Set', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: { entry: barbell } })
    await wrapper.find('[data-test="set-weight-new"]').setValue('185')
    await wrapper.find('[data-test="set-reps-new"]').setValue('8')
    await wrapper.find('[data-test="set-save-new"]').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toEqual({ weight: 185, reps: 8, distanceMeters: null, durationSeconds: null })
  })

  it('takes a preset weight and re-applies the same number on a new seq', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: { entry: barbell, presetWeight: { weight: 200, seq: 1 } } })
    expect(input(wrapper, 'set-weight-new').value).toBe('200')
    await wrapper.find('[data-test="set-weight-new"]').setValue('210')
    await wrapper.setProps({ presetWeight: { weight: 200, seq: 2 } })
    expect(input(wrapper, 'set-weight-new').value).toBe('200')
  })

  it('renders the cardio measures for a distance_time exercise', async () => {
    const cardio = { ...barbell, trackingType: 'distance_time' as const, loadStyle: null, barWeight: null, plateSizes: null, sets: [], lastSets: [] }
    const wrapper = await mountSuspended(WorkoutSetForm, { props: { entry: cardio } })
    expect(wrapper.find('[data-test="set-distance-new"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="set-duration-new"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="set-weight-new"]').exists()).toBe(false)
  })

  it('ignores a preset weight for a tracking type without a weight measure', async () => {
    const cardio = { ...barbell, trackingType: 'distance_time' as const, loadStyle: null, barWeight: null, plateSizes: null, sets: [], lastSets: [] }
    const wrapper = await mountSuspended(WorkoutSetForm, { props: { entry: cardio, presetWeight: { weight: 200, seq: 1 } } })
    await wrapper.find('[data-test="set-save-new"]').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toMatchObject({ weight: null })
  })

  it('shows the assistance with a minus sign for an assisted exercise', async () => {
    const assisted = { ...barbell, loadStyle: 'assisted' as const, barWeight: null, plateSizes: null, sets: [set(1, 40, 8)] }
    const wrapper = await mountSuspended(WorkoutSetForm, { props: { entry: assisted } })
    expect(wrapper.find('[data-test="set-assist-new"]').text()).toBe('−40')
  })
})
