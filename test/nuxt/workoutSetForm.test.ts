import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { WorkoutEntry } from '../../shared/types/workout'
import { progressionFor } from '../../shared/utils/workoutProgression'
import WorkoutSetForm from '../../app/components/workout/WorkoutSetForm.vue'

const set = (id: number, weight: number | null, reps: number | null) => ({
  id, sortOrder: id, weight, reps, distanceMeters: null, durationSeconds: null, done: false, comment: null, records: []
})

const barbell = {
  id: 9, exerciseId: 7, exerciseName: 'Barbell Squat', sortOrder: 0, trackingType: 'weight_reps' as const,
  loadStyle: 'barbell' as const, barWeight: 45, weightIncrement: null, restSeconds: null,
  plateSizes: [55, 45, 35, 25, 10, 5, 2.5], notes: null, target: null, supersetGroup: null, optional: false, restOverrideSeconds: null, sets: [set(1, 175, 5)], lastSets: [{ weight: 165, reps: 5 }]
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
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at(assisted) })
    expect(wrapper.find('[data-test="set-assist-new"]').text()).toBe('−40')
  })

  it('hints the target range and prefills the target weight on the first set', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, {
      props: { entry: { ...barbell, sets: [], lastSets: [], target: { sets: 3, low: 5, high: 8, weight: 135 } } }
    })
    expect(wrapper.find('[data-test="set-reps-new"]').attributes('placeholder')).toBe('5–8')
    expect(input(wrapper, 'set-weight-new').value).toBe('135')
  })

  const ranged = { ...barbell, weightIncrement: 10, target: { sets: 3, low: 4, high: 6, weight: 135 } }

  const at = (entry: WorkoutEntry, deload = false) => ({ entry, progression: progressionFor(entry, deload) })

  const text = (wrapper: Awaited<ReturnType<typeof mountSuspended>>, test: string) => wrapper.find(`[data-test="${test}"]`).text()
  const callout = (wrapper: Awaited<ReturnType<typeof mountSuspended>>) => wrapper.find('[data-test="set-progression-callout"]')

  it('shows the add callout and keeps the weight just used until the user chooses', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at({ ...ranged, sets: [set(1, 185, 6)] }) })
    expect(input(wrapper, 'set-weight-new').value).toBe('185')
    expect(text(wrapper, 'set-progression-heading')).toBe('Add weight?')
    expect(text(wrapper, 'set-progression-body')).toBe('You hit 6 reps at 185 lb — the top of 4–6.')
    expect(text(wrapper, 'set-progression-apply')).toBe('Add 10 lb → 195 lb')
    expect(text(wrapper, 'set-progression-stay')).toBe('Stay at 185 lb')
  })

  it('asks the parent for the choice, and applying moves the field to the suggestion', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at({ ...ranged, sets: [set(1, 185, 6)] }) })
    await wrapper.find('[data-test="set-progression-apply"]').trigger('click')
    await wrapper.find('[data-test="set-progression-stay"]').trigger('click')
    expect(wrapper.emitted('choose')).toEqual([['apply'], ['stay']])
    await wrapper.setProps({ choice: 'apply' })
    expect(input(wrapper, 'set-weight-new').value).toBe('195')
    expect(callout(wrapper).exists()).toBe(false)
  })

  it('stay keeps the weight just used and hides the callout', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at({ ...ranged, sets: [set(1, 185, 6)] }) })
    await wrapper.setProps({ choice: 'stay' })
    expect(input(wrapper, 'set-weight-new').value).toBe('185')
    expect(callout(wrapper).exists()).toBe(false)
  })

  it('applying keeps the reps the user typed', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at({ ...ranged, sets: [set(1, 185, 6)] }) })
    await wrapper.find('[data-test="set-reps-new"]').setValue('4')
    await wrapper.setProps({ choice: 'apply' })
    expect(input(wrapper, 'set-reps-new').value).toBe('4')
  })

  it('the choice reset shows the callout again for the next suggestion', async () => {
    const entry = { ...ranged, sets: [set(1, 185, 6)] }
    const wrapper = await mountSuspended(WorkoutSetForm, { props: { ...at(entry), choice: 'apply' as const } })
    expect(input(wrapper, 'set-weight-new').value).toBe('195')
    await wrapper.setProps({ ...at({ ...entry, sets: [set(1, 185, 6), set(2, 195, 6)] }), choice: null })
    expect(input(wrapper, 'set-weight-new').value).toBe('195')
    expect(text(wrapper, 'set-progression-body')).toBe('You hit 6 reps at 195 lb — the top of 4–6.')
  })

  it('shows the carried-over suggestion with the last weight and the target weight is not used', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at({ ...ranged, sets: [], lastSets: [{ weight: 185, reps: 6 }] }) })
    expect(input(wrapper, 'set-weight-new').value).toBe('185')
    expect(text(wrapper, 'set-progression-heading')).toBe('Add weight?')
    await wrapper.setProps({ choice: 'apply' })
    expect(input(wrapper, 'set-weight-new').value).toBe('195')
  })

  it('shows no callout inside the range and keeps the target weight on set 1', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at({ ...ranged, sets: [], lastSets: [{ weight: 185, reps: 5 }] }) })
    expect(input(wrapper, 'set-weight-new').value).toBe('135')
    expect(callout(wrapper).exists()).toBe(false)
  })

  it('offers the drop after a failed bump', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at({ ...ranged, sets: [set(1, 185, 6), set(2, 195, 3)] }) })
    expect(input(wrapper, 'set-weight-new').value).toBe('195')
    expect(text(wrapper, 'set-progression-heading')).toBe('Drop back?')
    expect(text(wrapper, 'set-progression-body')).toBe('3 reps at 195 lb is below 4–6.')
    expect(text(wrapper, 'set-progression-apply')).toBe('Drop to 185 lb')
    await wrapper.setProps({ choice: 'apply' })
    expect(input(wrapper, 'set-weight-new').value).toBe('185')
  })

  it('shows no callout in a deload', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at({ ...ranged, sets: [set(1, 185, 6)] }, true) })
    expect(input(wrapper, 'set-weight-new').value).toBe('185')
    expect(callout(wrapper).exists()).toBe(false)
  })

  it('uses assist wording for an assisted exercise', async () => {
    const assisted = { ...ranged, loadStyle: 'assisted' as const, barWeight: null, plateSizes: null, sets: [set(1, 40, 6)] }
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at(assisted) })
    expect(input(wrapper, 'set-weight-new').value).toBe('40')
    expect(text(wrapper, 'set-progression-heading')).toBe('Less assist?')
    expect(text(wrapper, 'set-progression-apply')).toBe('Less assist → 30 lb')
    await wrapper.setProps({ choice: 'apply' })
    expect(input(wrapper, 'set-weight-new').value).toBe('30')
  })

  it('re-seeds when an edit changes the suggestion', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at({ ...ranged, sets: [set(1, 185, 5)] }) })
    expect(input(wrapper, 'set-weight-new').value).toBe('185')
    expect(callout(wrapper).exists()).toBe(false)
    await wrapper.setProps(at({ ...ranged, sets: [set(1, 185, 6)] }))
    expect(callout(wrapper).exists()).toBe(true)
  })

  it('reports its current weight to the parent', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at({ ...ranged, sets: [set(1, 185, 6)] }) })
    expect(wrapper.emitted('weight')![0]).toEqual([185])
    await wrapper.find('[data-test="set-weight-new"]').setValue('200')
    expect(wrapper.emitted('weight')!.at(-1)).toEqual([200])
  })

  it('preset weight beats the suggestion', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, {
      props: { ...at({ ...ranged, sets: [set(1, 185, 6)] }), presetWeight: { weight: 200, seq: 1 } }
    })
    expect(input(wrapper, 'set-weight-new').value).toBe('200')
  })

  it('keeps typed values when an equivalent entry arrives', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at({ ...ranged, sets: [set(1, 185, 6)] }) })
    await wrapper.find('[data-test="set-weight-new"]').setValue('200')
    await wrapper.setProps(at({ ...ranged, sets: [{ ...set(1, 185, 6), done: true }] }))
    expect(input(wrapper, 'set-weight-new').value).toBe('200')
  })

  it('renders the suggestion the card passes instead of deriving its own', async () => {
    const entry = { ...ranged, sets: [set(1, 185, 5)] }
    const wrapper = await mountSuspended(WorkoutSetForm, {
      props: { entry, progression: { kind: 'drop' as const, weight: 175, fromWeight: 185, reps: 5 } }
    })
    expect(text(wrapper, 'set-progression-heading')).toBe('Drop back?')
  })

  it('keeps typed values when a set is deleted', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at({ ...barbell, sets: [set(1, 175, 5), set(2, 205, 6)] }) })
    await wrapper.find('[data-test="set-weight-new"]').setValue('215')
    await wrapper.setProps(at({ ...barbell, sets: [set(1, 175, 5)] }))
    expect(wrapper.find('[data-test="set-form-heading"]').text()).toBe('Set 2')
    expect(input(wrapper, 'set-weight-new').value).toBe('215')
  })

  it('re-seeds on a delete when nothing was typed', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at({ ...barbell, sets: [set(1, 175, 5), set(2, 205, 6)] }) })
    await wrapper.setProps(at({ ...barbell, sets: [set(1, 175, 5)] }))
    expect(input(wrapper, 'set-weight-new').value).toBe('175')
  })

  it('hides the assistance caption at zero assist', async () => {
    const assisted = { ...barbell, loadStyle: 'assisted' as const, barWeight: null, plateSizes: null, sets: [set(1, 40, 8)] }
    const wrapper = await mountSuspended(WorkoutSetForm, { props: at(assisted) })
    await wrapper.find('[data-test="set-weight-new"]').setValue('0')
    expect(wrapper.find('[data-test="set-assist-new"]').exists()).toBe(false)
  })

  const run = { ...barbell, trackingType: 'distance_time' as const, loadStyle: null, barWeight: null, plateSizes: null, sets: [], lastSets: [] }

  it('takes distance in miles and duration as m:ss and logs metres and seconds', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, { props: { entry: run } })
    expect(wrapper.text()).toContain('Distance (mi)')
    expect(wrapper.text()).toContain('Duration (m:ss)')
    await wrapper.find('[data-test="set-distance-new"]').setValue('3.1')
    await wrapper.find('[data-test="set-duration-new"]').setValue('2530')
    await wrapper.find('[data-test="set-save-new"]').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toEqual({ weight: null, reps: null, distanceMeters: 4988.97, durationSeconds: 1530 })
  })

  it('prefills cardio from last time in miles and m:ss', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, {
      props: { entry: { ...run, lastSets: [{ distanceMeters: 5000, durationSeconds: 1800 }] } }
    })
    expect(input(wrapper, 'set-distance-new').value).toBe('3.11')
    expect(input(wrapper, 'set-duration-new').value).toBe('30:00')
  })

  it('logs the stored distance exactly when only the time was edited', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, {
      props: { entry: { ...run, lastSets: [{ distanceMeters: 100, durationSeconds: 30 }] } }
    })
    await wrapper.find('[data-test="set-duration-new"]').setValue('45')
    await wrapper.find('[data-test="set-save-new"]').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toEqual({ weight: null, reps: null, distanceMeters: 100, durationSeconds: 45 })
  })

  it('hints a time target as a clock range', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, {
      props: { entry: { ...run, target: { sets: 1, low: 1200, high: 1500, weight: null } } }
    })
    expect(wrapper.find('[data-test="set-duration-new"]').attributes('placeholder')).toBe('20:00–25:00')
    expect(wrapper.find('[data-test="set-distance-new"]').attributes('placeholder')).toBe('')
  })

  it('steps distance by a tenth of a mile and duration by 30 s', async () => {
    const wrapper = await mountSuspended(WorkoutSetForm, {
      props: { entry: { ...run, lastSets: [{ distanceMeters: 1609.344, durationSeconds: 600 }] } }
    })
    const steppers = wrapper.findAll('[aria-label="Increase"]')
    await steppers[0]!.trigger('click')
    await steppers[1]!.trigger('click')
    expect(input(wrapper, 'set-distance-new').value).toBe('1.1')
    expect(input(wrapper, 'set-duration-new').value).toBe('10:30')
  })
})
