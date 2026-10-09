import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import WorkoutCopySheet from '../../app/components/workout/WorkoutCopySheet.vue'

const find = (selector: string) => new DOMWrapper(document.querySelector(selector))
const set = (id: number) => ({ id, sortOrder: id, weight: 100, reps: 8, distanceMeters: null, durationSeconds: null, done: false, comment: null, records: [] })
const entry = (id: number, name: string, sets: number) => ({
  id, exerciseId: id, exerciseName: name, sortOrder: id, trackingType: 'weight_reps', loadStyle: 'plain', barWeight: null,
  weightIncrement: null, restSeconds: null, plateSizes: null, notes: null, sets: Array.from({ length: sets }, (_, i) => set(i + 1)),
  lastSets: [], target: null, supersetGroup: null, optional: false, restOverrideSeconds: null
})

registerEndpoint('/api/workouts/sessions/41', () => ({
  id: 41, name: 'Push', performedOn: '2026-09-28', startedAt: '2026-09-28T10:00:00.000Z', endedAt: null, notes: null,
  routineDayId: null, deload: false, entries: [entry(1, 'Bench Press', 4), entry(2, 'Dips', 3)]
}))

registerEndpoint('/api/workouts/sessions', () => [
  { id: 41, name: 'Push', performedOn: '2026-09-28', exerciseCount: 2, setCount: 7 }
])

afterEach(() => {
  document.body.innerHTML = ''
})

describe('WorkoutCopySheet', () => {
  it('ticks every exercise, shows set counts, and emits only the ticked ones', async () => {
    const wrapper = await mountSuspended(WorkoutCopySheet, { attachTo: document.body, props: { open: false, sourceId: 41 } })
    await wrapper.setProps({ open: true })
    await vi.waitFor(() => expect(document.querySelector('[data-test="copy-entry-1"]')).not.toBeNull())
    await flushPromises()
    expect(find('[data-test="copy-entry-1"]').text()).toContain('4 sets')
    await find('[data-test="copy-entry-2"]').trigger('click')
    await find('[data-test="copy-start"]').trigger('click')
    expect(wrapper.emitted('start')).toEqual([[{ copyFromId: 41, entryIds: [1] }]])
    wrapper.unmount()
  })

  it('goes back from the checklist to the list of past workouts', async () => {
    const wrapper = await mountSuspended(WorkoutCopySheet, { attachTo: document.body, props: { open: false } })
    await wrapper.setProps({ open: true })
    await vi.waitFor(() => expect(document.querySelector('[data-test="copy-session-41"]')).not.toBeNull())
    await find('[data-test="copy-session-41"]').trigger('click')
    await vi.waitFor(() => expect(document.querySelector('[data-test="copy-entry-1"]')).not.toBeNull())
    await find('[data-test="copy-back"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-test="copy-list"]')).not.toBeNull()
    expect(document.querySelector('[data-test="copy-entry-1"]')).toBeNull()
    wrapper.unmount()
  })

  it('has no Back when it was opened on one workout', async () => {
    const wrapper = await mountSuspended(WorkoutCopySheet, { attachTo: document.body, props: { open: false, sourceId: 41 } })
    await wrapper.setProps({ open: true })
    await vi.waitFor(() => expect(document.querySelector('[data-test="copy-entry-1"]')).not.toBeNull())
    expect(document.querySelector('[data-test="copy-back"]')).toBeNull()
    wrapper.unmount()
  })
})
