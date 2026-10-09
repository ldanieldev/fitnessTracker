import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import WorkoutDayPickerSheet from '../../app/components/workout/WorkoutDayPickerSheet.vue'

const find = (selector: string) => new DOMWrapper(document.querySelector(selector))
const day = (id: number, name: string, floating = false) => ({
  id,
  name,
  description: null,
  floating,
  sortOrder: id,
  entries: []
})

registerEndpoint('/api/workouts/routines', () => [
  { id: 9, name: 'Upper/Lower', active: true, dayCount: 3, nextDay: { id: 1, name: 'Upper' } }
])
registerEndpoint('/api/workouts/routines/9', () => ({
  id: 9,
  name: 'Upper/Lower',
  notes: null,
  active: true,
  nextDayId: 1,
  days: [day(1, 'Upper'), day(2, 'Lower'), day(3, 'Arms', true)]
}))

afterEach(() => {
  document.body.innerHTML = ''
})

async function openRoutine() {
  const wrapper = await mountSuspended(WorkoutDayPickerSheet, { attachTo: document.body, props: { open: false } })
  await wrapper.setProps({ open: true })
  await vi.waitFor(() => expect(document.querySelector('[data-test="routine-pick-9"]')).not.toBeNull())
  await find('[data-test="routine-pick-9"]').trigger('click')
  await vi.waitFor(() => expect(document.querySelector('[data-test="day-pick-1"]')).not.toBeNull())
  return wrapper
}

describe('WorkoutDayPickerSheet', () => {
  it('badges the due day and starts it without asking', async () => {
    const wrapper = await openRoutine()
    expect(document.querySelector('[data-test="day-pick-1"] [data-test="day-next-badge"]')).not.toBeNull()
    await find('[data-test="day-pick-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('start')).toEqual([[{ routineDayId: 1 }]])
    expect(document.querySelector('[data-test="pointer-prompt-text"]')).toBeNull()
    wrapper.unmount()
  })

  it('asks before an off-order day and passes the choice on', async () => {
    const wrapper = await openRoutine()
    await find('[data-test="day-pick-2"]').trigger('click')
    expect(wrapper.emitted('start')).toBeUndefined()
    await vi.waitFor(() => expect(document.querySelector('[data-test="pointer-prompt-text"]')).not.toBeNull())
    expect(find('[data-test="pointer-prompt-text"]').text()).toBe('You\'re starting Lower but Upper is next.')
    await find('[data-test="pointer-skip"]').trigger('click')
    expect(wrapper.emitted('start')).toEqual([[{ routineDayId: 2, pointer: 'skip' }]])
    wrapper.unmount()
  })

  it('starts a floating day without asking', async () => {
    const wrapper = await openRoutine()
    await find('[data-test="day-pick-3"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('start')).toEqual([[{ routineDayId: 3 }]])
    expect(document.querySelector('[data-test="pointer-prompt-text"]')).toBeNull()
    wrapper.unmount()
  })

  it('goes back to the routine list', async () => {
    const wrapper = await openRoutine()
    await find('[data-test="day-picker-back"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('[data-test="routine-pick-9"]')).not.toBeNull()
    expect(document.querySelector('[data-test="day-pick-1"]')).toBeNull()
    wrapper.unmount()
  })
})
