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
  it('labels the range in seconds for a timed exercise and hides weight', async () => {
    const wrapper = await mountSuspended(WorkoutRoutineEntrySheet, { attachTo: document.body, props: { open: true, entry } })
    await flushPromises()
    expect(new DOMWrapper(document.body).text()).toContain('Range (sec)')
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
})
