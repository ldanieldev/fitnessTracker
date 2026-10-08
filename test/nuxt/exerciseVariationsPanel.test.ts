import { describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import ExerciseVariationsPanel from '../../app/components/workout/ExerciseVariationsPanel.vue'

const category = { id: 1, key: 'chest', name: 'Chest', color: 'rose', sortOrder: 0, shared: true, hidden: false }
const detail = (id: number, name: string, variations: { id: number, name: string }[]) => ({
  id,
  name,
  category,
  trackingType: 'weight_reps' as const,
  loadStyle: 'barbell' as const,
  barWeight: 45,
  weightIncrement: null,
  restSeconds: null,
  plateSizes: null,
  difficulty: null,
  equipment: [],
  primaryMuscles: [],
  secondaryMuscles: [],
  images: [],
  notes: null,
  link: null,
  favorite: false,
  hidden: false,
  shared: true,
  overridden: { category: false, trackingType: false, loadStyle: false, barWeight: false },
  defaultGraph: null,
  instructions: [],
  variations
})

const { toastAdd } = vi.hoisted(() => ({ toastAdd: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: toastAdd }))

let groupReads = 0
registerEndpoint('/api/workouts/variations', {
  method: 'GET',
  handler: () => {
    groupReads++
    return [
      { id: 5, name: 'Bench family', exerciseIds: [21, 22] },
      { id: 6, name: 'Rows', exerciseIds: [30] }
    ]
  }
})
registerEndpoint('/api/workouts/variations/5', {
  method: 'PATCH',
  handler: () => {
    throw createError({ statusCode: 409, statusMessage: 'Group is full' })
  }
})
let posted: unknown = null
registerEndpoint('/api/workouts/variations', {
  method: 'POST',
  handler: async (event) => {
    posted = await readBody(event)
    return { id: 7, name: 'Squat family', exerciseIds: [40] }
  }
})
let patched: unknown = null
registerEndpoint('/api/workouts/variations/6', {
  method: 'PATCH',
  handler: async (event) => {
    patched = await readBody(event)
    return { id: 6, name: 'Rows', exerciseIds: [30, 40] }
  }
})

// AppSheet teleports its body out of the mounted subtree, so query the attached document instead of wrapper.find.
function find(selector: string) {
  return new DOMWrapper(document.querySelector(selector))
}

describe('ExerciseVariationsPanel', () => {
  it('lists the group and links to each variation', async () => {
    const wrapper = await mountSuspended(ExerciseVariationsPanel, {
      attachTo: document.body,
      props: { exercise: detail(21, 'Bench Press', [{ id: 22, name: 'Incline Bench' }]) }
    })
    await flushPromises()
    const list = wrapper.find('[data-test="variation-list"]')
    expect(list.text()).toContain('Bench family')
    expect(list.find('a[href="/workouts/exercises/22"]').text()).toBe('Incline Bench')
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('links an unlinked exercise to an existing group', async () => {
    patched = null
    const wrapper = await mountSuspended(ExerciseVariationsPanel, {
      attachTo: document.body,
      props: { exercise: detail(40, 'Back Squat', []) }
    })
    await flushPromises()
    expect(wrapper.find('[data-test="variation-list"]').text()).toContain('No variations linked yet')
    await wrapper.find('[data-test="variation-link"]').trigger('click')
    await flushPromises()
    await find('[data-test="variation-group-6"]').trigger('click')
    await vi.waitFor(() => expect(patched).toEqual({ addExerciseIds: [40] }))
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('creates a new group for the exercise', async () => {
    posted = null
    const wrapper = await mountSuspended(ExerciseVariationsPanel, {
      attachTo: document.body,
      props: { exercise: detail(40, 'Back Squat', []) }
    })
    await flushPromises()
    await wrapper.find('[data-test="variation-link"]').trigger('click')
    await flushPromises()
    await find('[data-test="variation-new"]').trigger('click')
    await find('[data-test="variation-name"]').setValue('Squat family')
    await find('[data-test="variation-save"]').trigger('click')
    await vi.waitFor(() => expect(posted).toEqual({ name: 'Squat family', exerciseIds: [40] }))
    wrapper.unmount()
    document.body.innerHTML = ''
  })
  it('toasts a failed link and refetches nothing', async () => {
    toastAdd.mockReset()
    const wrapper = await mountSuspended(ExerciseVariationsPanel, {
      attachTo: document.body,
      props: { exercise: detail(40, 'Back Squat', []) }
    })
    await flushPromises()
    const readsBefore = groupReads
    await wrapper.find('[data-test="variation-link"]').trigger('click')
    await flushPromises()
    await find('[data-test="variation-group-5"]').trigger('click')
    await vi.waitFor(() => expect(toastAdd).toHaveBeenCalledTimes(1))
    expect(toastAdd.mock.calls[0]![0]).toMatchObject({ title: 'Couldn\'t link variation', description: 'Group is full', color: 'error' })
    await flushPromises()
    expect(groupReads).toBe(readsBefore)
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
