import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutSetRow from '../../app/components/workout/WorkoutSetRow.vue'

const logged = {
  id: 3, sortOrder: 0, weight: 185, reps: 8, distanceMeters: null, durationSeconds: null, done: false, comment: null, records: []
}

const base = { set: logged, index: 0, trackingType: 'weight_reps' as const, loadStyle: 'plain' as const }

async function openMenu(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  await wrapper.find('[data-test="set-menu-3"]').trigger('click')
}

// startEdit closes the menu first and enters edit mode a tick later, so the form needs the second tick to render.
async function startEdit(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  await openMenu(wrapper)
  document.body.querySelector<HTMLElement>('[data-test="set-edit-3"]')!.click()
  await nextTick()
  await nextTick()
}

afterEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
})

describe('WorkoutSetRow', () => {
  it('reads the set with its volume and no inputs', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, { props: base })
    expect(wrapper.find('[data-test="set-line-3"]').text()).toContain('Set 1')
    expect(wrapper.find('[data-test="set-measure-3-weight"]').text()).toBe('185 lb')
    expect(wrapper.find('[data-test="set-measure-3-reps"]').text()).toBe('8 reps')
    expect(wrapper.find('[data-test="set-volume-3"]').text()).toBe('1,480 vol')
    expect(wrapper.find('[data-test="set-volume-3"]').classes()).toContain('max-sm:hidden')
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('shows the volume as a disabled first item in the menu', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, { props: base })
    await openMenu(wrapper)
    expect(document.body.querySelector('[data-test="set-volume-menu-3"]')!.textContent).toBe('1,480 vol')
    // Unmounting while Reka still has the menu open strands body pointer-events (LR-R8), so close it first.
    await document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
  })

  it('reads cardio measures and shows no volume', async () => {
    const cardio = { ...logged, weight: null, reps: null, distanceMeters: 5000, durationSeconds: 1800 }
    const wrapper = await mountSuspended(WorkoutSetRow, { props: { ...base, set: cardio, trackingType: 'distance_time' } })
    expect(wrapper.find('[data-test="set-measure-3-distance"]').text()).toBe('5000 m')
    expect(wrapper.find('[data-test="set-measure-3-duration"]').text()).toBe('1800 s')
    expect(wrapper.find('[data-test="set-volume-3"]').exists()).toBe(false)
  })

  it('shows the assistance with a minus sign', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, { props: { ...base, set: { ...logged, weight: 40 }, loadStyle: 'assisted' } })
    expect(wrapper.find('[data-test="set-measure-3-weight"]').text()).toBe('−40 lb')
  })

  it('shows a trophy only when the set holds a record', async () => {
    const plain = await mountSuspended(WorkoutSetRow, { props: base })
    expect(plain.find('[data-test="set-record-3"]').exists()).toBe(false)
    const record = await mountSuspended(WorkoutSetRow, {
      props: { ...base, set: { ...logged, records: [{ kind: 'weight_reps' as const, previous: 175 }] } }
    })
    expect(record.find('[data-test="set-record-3"]').exists()).toBe(true)
  })

  it('edits inline from the menu, saves the new values and re-checks nothing else', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, { props: base })
    await startEdit(wrapper)
    await wrapper.find('[data-test="set-weight-3"]').setValue('195')
    await wrapper.find('[data-test="set-save-3"]').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toEqual({ weight: 195, reps: 8, distanceMeters: null, durationSeconds: null })
    expect(wrapper.find('[data-test="set-weight-3"]').exists()).toBe(false)
  })

  it('cancels an edit without emitting', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, { props: base })
    await startEdit(wrapper)
    await wrapper.find('[data-test="set-weight-3"]').setValue('195')
    await wrapper.find('[data-test="set-cancel-3"]').trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.find('[data-test="set-measure-3-weight"]').text()).toBe('185 lb')
  })

  it('leaves the page tappable after an edit from the menu', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, { props: base })
    await startEdit(wrapper)
    await wrapper.find('[data-test="set-save-3"]').trigger('click')
    await nextTick()
    expect(document.body.style.pointerEvents).not.toBe('none')
    expect(document.querySelectorAll('[aria-expanded="true"]')).toHaveLength(0)
  })

  it('emits remove from the menu', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, { props: base })
    await openMenu(wrapper)
    await document.body.querySelector<HTMLElement>('[data-test="set-remove-3"]')!.click()
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('toggles a note under the line and saves it on blur with the measures', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, { props: base })
    expect(wrapper.find('[data-test="set-note-3"]').exists()).toBe(false)
    await wrapper.find('[data-test="set-comment-3"]').trigger('click')
    const note = wrapper.find('[data-test="set-note-3"]')
    await note.setValue('easy')
    await note.trigger('blur')
    expect(wrapper.emitted('save')![0]![0]).toEqual({ comment: 'easy' })
  })

  it('keeps an open edit when the set is replaced', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, { props: base })
    await startEdit(wrapper)
    await wrapper.find('[data-test="set-weight-3"]').setValue('195')
    await wrapper.setProps({ set: { ...logged, reps: 9 } })
    expect((wrapper.find('[data-test="set-weight-3"]').element as HTMLInputElement).value).toBe('195')
  })

  it('keeps a note being typed when the set is replaced', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, { props: base })
    await wrapper.find('[data-test="set-comment-3"]').trigger('click')
    const note = wrapper.find('[data-test="set-note-3"]')
    await note.trigger('focus')
    await note.setValue('wip')
    await wrapper.setProps({ set: { ...logged, reps: 9 } })
    expect((wrapper.find('[data-test="set-note-3"]').element as HTMLTextAreaElement).value).toBe('wip')
  })

  it('opens with the note visible when the set already has a comment', async () => {
    const wrapper = await mountSuspended(WorkoutSetRow, { props: { ...base, set: { ...logged, comment: 'felt heavy' } } })
    expect((wrapper.find('[data-test="set-note-3"]').element as HTMLTextAreaElement).value).toBe('felt heavy')
  })
})
