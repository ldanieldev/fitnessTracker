import { describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutRoutineEntrySheet from '../../app/components/workout/WorkoutRoutineEntrySheet.vue'

const find = (selector: string) => new DOMWrapper(document.querySelector(selector))
const entry = {
  id: 5, exerciseId: 1, exerciseName: 'Plank', trackingType: 'time' as const, deleted: false, sortOrder: 0,
  target: { sets: 3, low: 30, high: 45, weight: null }, supersetGroup: null, optional: false, restSeconds: null, notes: null
}

describe('WorkoutRoutineEntrySheet', () => {
  it('labels the range as m:ss for a timed exercise and hides weight', async () => {
    const wrapper = await mountSuspended(WorkoutRoutineEntrySheet, { attachTo: document.body, props: { open: true, entry } })
    await flushPromises()
    expect(new DOMWrapper(document.body).text()).toContain('Range (m:ss)')
    expect((find('[data-test="routine-entry-low"]').element as HTMLInputElement).value).toBe('0:30')
    expect((find('[data-test="routine-entry-high"]').element as HTMLInputElement).value).toBe('0:45')
    expect(find('[data-test="routine-entry-weight"]').exists()).toBe(false)
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('refuses a range that runs high to low', async () => {
    const wrapper = await mountSuspended(WorkoutRoutineEntrySheet, {
      attachTo: document.body,
      props: { open: true, entry: { ...entry, target: { sets: 3, low: 50, high: 45, weight: null } } }
    })
    await flushPromises()
    await find('[data-test="routine-entry-save"]').trigger('click')
    expect(find('[data-test="routine-entry-error"]').text()).toBe('The range must run low to high')
    expect(wrapper.emitted('save')).toBeUndefined()
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('saves the edited fields', async () => {
    const wrapper = await mountSuspended(WorkoutRoutineEntrySheet, { attachTo: document.body, props: { open: true, entry } })
    await flushPromises()
    await find('[data-test="routine-entry-save"]').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toEqual({
      targetSets: 3, targetLow: 30, targetHigh: 45, targetWeight: null, restSeconds: null, optional: false, notes: null
    })
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('saves a typed clock range as seconds', async () => {
    const wrapper = await mountSuspended(WorkoutRoutineEntrySheet, { attachTo: document.body, props: { open: true, entry } })
    await flushPromises()
    await find('[data-test="routine-entry-low"]').setValue('0:40')
    await find('[data-test="routine-entry-high"]').setValue('100')
    await find('[data-test="routine-entry-save"]').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toMatchObject({ targetLow: 40, targetHigh: 60 })
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('edits a distance range in miles and saves metres', async () => {
    const mile = { ...entry, exerciseName: 'Run', trackingType: 'distance' as const, target: { sets: 1, low: 1609.344, high: 3218.688, weight: null } }
    const wrapper = await mountSuspended(WorkoutRoutineEntrySheet, { attachTo: document.body, props: { open: true, entry: mile } })
    await flushPromises()
    expect(new DOMWrapper(document.body).text()).toContain('Range (mi)')
    expect((find('[data-test="routine-entry-low"]').element as HTMLInputElement).value).toBe('1')
    await find('[data-test="routine-entry-low"]').setValue('1.5')
    await find('[data-test="routine-entry-save"]').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toMatchObject({ targetLow: 2414.02, targetHigh: 3218.688 })
    wrapper.unmount()
    document.body.innerHTML = ''
  })
  it('saves untouched non-round distance bounds exactly, even after focus and blur', async () => {
    const run = { ...entry, exerciseName: 'Run', trackingType: 'distance' as const, target: { sets: 1, low: 5000, high: 5000, weight: null } }
    const wrapper = await mountSuspended(WorkoutRoutineEntrySheet, { attachTo: document.body, props: { open: true, entry: run } })
    await flushPromises()
    for (const bound of ['low', 'high']) {
      await find(`[data-test="routine-entry-${bound}"]`).trigger('focus')
      await find(`[data-test="routine-entry-${bound}"]`).trigger('blur')
    }
    await find('[data-test="routine-entry-save"]').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toMatchObject({ targetLow: 5000, targetHigh: 5000 })
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
