import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutSetRow from '../../app/components/workout/WorkoutSetRow.vue'

const logged = {
  id: 3,
  sortOrder: 0,
  weight: 185,
  reps: 8,
  distanceMeters: null,
  durationSeconds: null,
  done: false,
  comment: null,
  records: []
}

describe('WorkoutSetRow', () => {
  it('shows weight and reps for a weight_reps exercise', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, {
      props: { set: logged, index: 0, trackingType: 'weight_reps', loadStyle: 'plain', lastSet: null, prefill: {} }
    })
    expect((wrapper.find('[data-test="set-weight-3"]').element as HTMLInputElement).value).toBe('185')
    expect((wrapper.find('[data-test="set-reps-3"]').element as HTMLInputElement).value).toBe('8')
    expect(wrapper.find('[data-test="set-distance-3"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="set-duration-3"]').exists()).toBe(false)
  })

  it('shows distance and duration for a distance_time exercise', async () => {
    const cardio = { ...logged, weight: null, reps: null, distanceMeters: 5000, durationSeconds: 1800 }
    const wrapper = await mountSuspended(WorkoutSetRow, {
      props: { set: cardio, index: 0, trackingType: 'distance_time', loadStyle: null, lastSet: null, prefill: {} }
    })
    expect(wrapper.find('[data-test="set-distance-3"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="set-duration-3"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="set-weight-3"]').exists()).toBe(false)
  })

  it('shows the assistance with a minus sign for an assisted exercise', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, {
      props: { set: { ...logged, weight: 20 }, index: 0, trackingType: 'weight_reps', loadStyle: 'assisted',
        lastSet: null, prefill: {} }
    })
    expect(wrapper.text()).toContain('−20')
  })

  it('shows the last-time line when one is given', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, {
      props: { set: logged, index: 0, trackingType: 'weight_reps', loadStyle: 'plain',
        lastSet: { weight: 175, reps: 8 }, prefill: {} }
    })
    expect(wrapper.find('[data-test="set-last-3"]').text()).toContain('175')
    expect(wrapper.find('[data-test="set-last-3"]').text()).toContain('8')
  })

  it('shows a trophy only when the set holds a record', async () => {
    const plain = await mountSuspended(WorkoutSetRow, {
      props: { set: logged, index: 0, trackingType: 'weight_reps', loadStyle: 'plain', lastSet: null, prefill: {} }
    })
    expect(plain.find('[data-test="set-record-3"]').exists()).toBe(false)
    const record = { ...logged, records: [{ kind: 'weight_reps' as const, previous: 175 }] }
    const starred = await mountSuspended(WorkoutSetRow, {
      props: { set: record, index: 0, trackingType: 'weight_reps', loadStyle: 'plain', lastSet: null, prefill: {} }
    })
    expect(starred.find('[data-test="set-record-3"]').exists()).toBe(true)
  })

  it('emits remove and renders no done toggle (LG-R20)', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, {
      props: { set: logged, index: 0, trackingType: 'weight_reps', loadStyle: 'plain', lastSet: null, prefill: {} }
    })
    expect(wrapper.find('[data-test="set-done-3"]').exists()).toBe(false)
    await wrapper.find('[data-test="set-remove-3"]').trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('starts the next-set row from the prefill and emits what was typed', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, {
      props: { index: 1, trackingType: 'weight_reps', loadStyle: 'plain', lastSet: null,
        prefill: { weight: 185, reps: 8 } }
    })
    expect((wrapper.find('[data-test="set-weight-new"]').element as HTMLInputElement).value).toBe('185')
    await wrapper.find('[data-test="set-reps-new"]').setValue('6')
    await wrapper.find('[data-test="set-save-new"]').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toMatchObject({ weight: 185, reps: 6 })
  })

  it('steps the next row weight by 5 when the exercise carries no increment', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, {
      props: { index: 1, trackingType: 'weight_reps', loadStyle: 'plain', lastSet: null,
        prefill: { weight: 185, reps: 8 } }
    })
    const weight = wrapper.find('input[data-test="set-weight-new"]').element as HTMLInputElement
    const stepper = weight.closest('[data-test="number-input"]')!.querySelector('button[aria-label="Increase"]') as HTMLButtonElement
    stepper.click()
    await nextTick()
    expect(weight.value).toBe('190')
  })

  it('shows the last-time line on the next-set row too', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, {
      props: { index: 1, trackingType: 'weight_reps', loadStyle: 'plain',
        lastSet: { weight: 175, reps: 6 }, prefill: { weight: 185, reps: 8 } }
    })
    expect(wrapper.find('[data-test="set-last-new"]').text()).toContain('175')
    expect(wrapper.find('[data-test="set-last-new"]').text()).toContain('6')
  })
})
