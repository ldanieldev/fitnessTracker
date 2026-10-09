import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutPhaseBar from '../../app/components/workout/WorkoutPhaseBar.vue'
import type { ProgramPhase } from '../../shared/types/program'

const phases: ProgramPhase[] = [
  { id: 1, name: 'Build', sortOrder: 0, weeks: 4, deload: false, routine: null },
  { id: 2, name: 'Deload', sortOrder: 1, weeks: 1, deload: true, routine: null },
  { id: 3, name: 'Peak', sortOrder: 2, weeks: 2, deload: false, routine: null }
]

async function fills(weeksDone: number) {
  const wrapper = await mountSuspended(WorkoutPhaseBar, { props: { phases, weeksDone } })
  return wrapper.findAll('[data-test="enrollment-segment"] > div').map((fill) => fill.attributes('style'))
}

describe('WorkoutPhaseBar', () => {
  it('sizes each segment by its weeks', async () => {
    const wrapper = await mountSuspended(WorkoutPhaseBar, { props: { phases, weeksDone: 0 } })
    expect(wrapper.findAll('[data-test="enrollment-segment"]').map((s) => s.attributes('style'))).toEqual([
      'flex-grow: 4; flex-basis: 0px;',
      'flex-grow: 1; flex-basis: 0px;',
      'flex-grow: 2; flex-basis: 0px;'
    ])
  })

  it('fills nothing before the first week is done', async () => {
    expect(await fills(0)).toEqual(['width: 0%;', 'width: 0%;', 'width: 0%;'])
  })

  it('fills part of the current phase', async () => {
    expect(await fills(1)).toEqual(['width: 25%;', 'width: 0%;', 'width: 0%;'])
  })

  it('fills completed phases fully and the next one partly', async () => {
    expect(await fills(6)).toEqual(['width: 100%;', 'width: 100%;', 'width: 50%;'])
  })

  it('clamps past the end', async () => {
    expect(await fills(99)).toEqual(['width: 100%;', 'width: 100%;', 'width: 100%;'])
  })
})
