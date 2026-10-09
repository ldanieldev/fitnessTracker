import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutEnrollmentCard from '../../app/components/workout/WorkoutEnrollmentCard.vue'
import type { Enrollment } from '../../shared/types/program'

const phases = [
  {
    id: 1,
    name: 'Hypertrophy',
    sortOrder: 0,
    weeks: 4,
    deload: false,
    routine: { id: 5, name: 'Upper/Lower', dayCount: 4 }
  },
  { id: 2, name: 'Deload', sortOrder: 1, weeks: 1, deload: true, routine: { id: 5, name: 'Upper/Lower', dayCount: 4 } },
  { id: 3, name: 'Off', sortOrder: 2, weeks: 1, deload: false, routine: null }
]
const base: Enrollment = {
  id: 9,
  program: { id: 3, name: 'BLS' },
  status: 'active',
  state: 'current',
  week: 2,
  totalWeeks: 6,
  phaseIndex: 0,
  weekInPhase: 2,
  phase: phases[0]!,
  phases,
  anchorDate: '2026-09-28',
  notice: null,
  nextDay: { id: 1, name: 'Upper A' }
}

describe('WorkoutEnrollmentCard', () => {
  it('shows week, phase and a segment per phase; pause and end emit', async () => {
    const wrapper = await mountSuspended(WorkoutEnrollmentCard, { props: { enrollment: base } })
    expect(wrapper.find('[data-test="enrollment-line"]').text()).toBe('Week 2 of 6 · Hypertrophy')
    expect(wrapper.findAll('[data-test="enrollment-segment"]')).toHaveLength(3)
    await wrapper.find('[data-test="enrollment-pause"]').trigger('click')
    await wrapper.find('[data-test="enrollment-end"]').trigger('click')
    expect(wrapper.emitted('pause')).toHaveLength(1)
    expect(wrapper.emitted('end')).toHaveLength(1)
    expect(wrapper.find('[data-test="enrollment-resume"]').exists()).toBe(false)
  })

  it('badges deload and rest weeks', async () => {
    const deload = await mountSuspended(WorkoutEnrollmentCard, {
      props: { enrollment: { ...base, week: 5, phaseIndex: 1, phase: phases[1]! } }
    })
    expect(deload.find('[data-test="enrollment-badge"]').text()).toBe('Deload')
    const rest = await mountSuspended(WorkoutEnrollmentCard, {
      props: { enrollment: { ...base, week: 6, phaseIndex: 2, phase: phases[2]! } }
    })
    expect(rest.find('[data-test="enrollment-badge"]').text()).toBe('Rest week')
  })

  it('paused shows resume; between shows the start date', async () => {
    const paused = await mountSuspended(WorkoutEnrollmentCard, {
      props: { enrollment: { ...base, status: 'paused', state: 'paused' } }
    })
    expect(paused.find('[data-test="enrollment-line"]').text()).toBe('Paused at week 2 of 6')
    await paused.find('[data-test="enrollment-resume"]').trigger('click')
    expect(paused.emitted('resume')).toHaveLength(1)
    const between = await mountSuspended(WorkoutEnrollmentCard, {
      props: { enrollment: { ...base, state: 'between', week: 1, anchorDate: '2026-10-05' } }
    })
    expect(between.find('[data-test="enrollment-line"]').text()).toBe('Starts Mon, Oct 5 · Week 1 of 6')
  })

  it('finished offers dismiss only', async () => {
    const done = await mountSuspended(WorkoutEnrollmentCard, {
      props: {
        enrollment: { ...base, status: 'completed', state: 'finished', notice: 'complete', phase: null, phaseIndex: -1 }
      }
    })
    expect(done.find('[data-test="enrollment-line"]').text()).toBe('Program complete')
    expect(done.find('[data-test="enrollment-pause"]').exists()).toBe(false)
    await done.find('[data-test="enrollment-dismiss"]').trigger('click')
    expect(done.emitted('dismiss')).toHaveLength(1)
  })
})
