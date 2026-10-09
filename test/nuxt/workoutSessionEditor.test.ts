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

  it('stays on the exercise and does not scroll while it has sets left', async () => {
    const after = session([entry(1, null, [logged]), entry(2, null)])
    const { wrapper, scroll } = await logFirstSet(session([entry(1, null), entry(2, null)]), after)
    expect(scroll).not.toHaveBeenCalled()
    expect(wrapper.findAllComponents(WorkoutExerciseCard).map((card) => card.props('collapsed'))).not.toContain(true)
    expect(wrapper.emitted('setLogged')).toEqual([[1, { open: null, rest: true, restFromEntryId: 1 }]])
    wrapper.unmount()
  })
})
