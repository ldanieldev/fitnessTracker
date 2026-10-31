import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { WorkoutEntry, WorkoutSession } from '../../shared/types/workout'
import WorkoutSessionEditor from '../../app/components/workout/WorkoutSessionEditor.vue'
import WorkoutExerciseCard from '../../app/components/workout/WorkoutExerciseCard.vue'

const entry = (id: number, supersetGroup: number | null, sets: WorkoutEntry['sets'] = []): WorkoutEntry => ({
  id,
  exerciseId: id,
  exerciseName: `Exercise ${id}`,
  sortOrder: id,
  trackingType: 'weight_reps',
  loadStyle: 'plain',
  barWeight: null,
  weightIncrement: null,
  restSeconds: null,
  plateSizes: null,
  notes: null,
  target: { sets: 3, low: null, high: null, weight: null },
  supersetGroup,
  optional: false,
  restOverrideSeconds: null,
  sets,
  lastSets: []
})
const logged = {
  id: 50,
  sortOrder: 0,
  weight: 100,
  reps: 8,
  distanceMeters: null,
  durationSeconds: null,
  done: false,
  comment: null,
  records: []
}
const session = (entries: WorkoutEntry[]): WorkoutSession => ({
  id: 7,
  name: null,
  performedOn: '2026-10-06',
  startedAt: '2026-10-06T10:00:00.000Z',
  endedAt: null,
  notes: null,
  routineDayId: null,
  deload: false,
  entries
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

async function logFirstSet(before: WorkoutSession, after: WorkoutSession) {
  registerEndpoint('/api/workouts/entries/1/sets', { method: 'POST', handler: () => ({ session: after }), once: true })
  const scroll = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
  const wrapper = await mountSuspended(WorkoutSessionEditor, { attachTo: document.body, props: { session: before } })
  wrapper.findAllComponents(WorkoutExerciseCard)[0]!.vm.$emit('addSet', { weight: 100, reps: 8 })
  await vi.waitFor(() => expect(wrapper.emitted('setLogged')).toBeDefined())
  await flushPromises()
  return { wrapper, scroll }
}

describe('WorkoutSessionEditor', () => {
  it('after a superset set, collapses the logged card, opens the partner and scrolls to it', async () => {
    const after = session([entry(1, 1, [logged]), entry(2, 1)])
    const { wrapper, scroll } = await logFirstSet(session([entry(1, 1), entry(2, 1)]), after)
    expect(wrapper.emitted('update:session')).toEqual([[after]])
    expect(wrapper.findAllComponents(WorkoutExerciseCard).map((card) => card.props('collapsed'))).toEqual([true, false])
    expect(scroll).toHaveBeenCalledTimes(1)
    expect((scroll.mock.contexts[0] as Element).getAttribute('data-test')).toBe('entry-card-2')
    expect(wrapper.emitted('setLogged')).toEqual([[1, { open: 2, rest: false, restFromEntryId: 1 }]])
    wrapper.unmount()
  })

  it('emits allSetsDone only once the last target is reached', async () => {
    const three = Array.from({ length: 3 }, (_, i) => ({ ...logged, id: 60 + i }))
    const partial = session([entry(1, null, three), entry(2, null)])
    const { wrapper: early } = await logFirstSet(session([entry(1, null), entry(2, null)]), partial)
    expect(early.emitted('allSetsDone')).toBeUndefined()
    early.unmount()

    const finished = session([entry(1, null, three), entry(2, null, three)])
    const { wrapper: last } = await logFirstSet(partial, finished)
    expect(last.emitted('allSetsDone')).toHaveLength(1)
    last.unmount()
  })

  it('holds allSetsDone until the progression prompt for the last set closes', async () => {
    const target = { sets: 1, low: 5, high: 8, weight: null }
    const finished = session([{ ...entry(1, null, [logged]), target }])
    const { wrapper } = await logFirstSet(session([{ ...entry(1, null), target }]), finished)
    expect(wrapper.emitted('allSetsDone')).toBeUndefined()
    wrapper.findComponent(WorkoutExerciseCard).vm.$emit('promptClosed')
    expect(wrapper.emitted('allSetsDone')).toHaveLength(1)
    wrapper.unmount()
  })

  it('stays on the exercise and does not scroll while it has sets left', async () => {
    const after = session([entry(1, null, [logged]), entry(2, null)])
    const { wrapper, scroll } = await logFirstSet(session([entry(1, null), entry(2, null)]), after)
    expect(scroll).not.toHaveBeenCalled()
    expect(wrapper.findAllComponents(WorkoutExerciseCard).map((card) => card.props('collapsed'))).not.toContain(true)
    expect(wrapper.emitted('setLogged')).toEqual([[1, { open: null, rest: true, restFromEntryId: 1 }]])
    wrapper.unmount()
  })

  it('ignores a second Log Set while the first is in flight and shows the button loading', async () => {
    let posts = 0
    let release: () => void = () => {}
    const after = session([entry(1, null, [logged])])
    registerEndpoint('/api/workouts/entries/1/sets', {
      method: 'POST',
      handler: () => {
        posts++
        return new Promise((resolve) => {
          release = () => resolve({ session: after })
        })
      }
    })
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    const wrapper = await mountSuspended(WorkoutSessionEditor, {
      attachTo: document.body,
      props: { session: session([entry(1, null)]) }
    })
    const button = () => wrapper.find('[data-test="set-save-new"]')

    await button().trigger('click')
    await vi.waitFor(() => expect(posts).toBe(1))
    expect(button().attributes('disabled')).toBeDefined()
    expect(wrapper.findAllComponents(WorkoutExerciseCard)[0]!.props('addingSet')).toBe(true)
    wrapper.findAllComponents(WorkoutExerciseCard)[0]!.vm.$emit('addSet', { weight: 100, reps: 8 })
    await button().trigger('click')
    await flushPromises()
    expect(posts).toBe(1)

    release()
    await vi.waitFor(() => expect(wrapper.emitted('setLogged')).toHaveLength(1))
    await flushPromises()
    expect(button().attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('drops an older session response that resolves after a newer one', async () => {
    const renamedOld = { ...session([entry(1, null)]), name: 'old' }
    const renamedNew = { ...session([entry(1, null)]), name: 'new' }
    const pending: Array<(value: WorkoutSession) => void> = []
    registerEndpoint('/api/workouts/sessions/7', {
      method: 'PATCH',
      handler: () => new Promise<WorkoutSession>((resolve) => pending.push(resolve))
    })
    const wrapper = await mountSuspended(WorkoutSessionEditor, { props: { session: session([entry(1, null)]) } })
    const header = wrapper.findComponent({ name: 'WorkoutSessionHeader' })

    header.vm.$emit('rename', 'old')
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    header.vm.$emit('rename', 'new')
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    pending[1]!(renamedNew)
    await vi.waitFor(() => expect(wrapper.emitted('update:session')).toHaveLength(1))
    pending[0]!(renamedOld)
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(wrapper.emitted('update:session')).toEqual([[renamedNew]])
    wrapper.unmount()
  })
})
