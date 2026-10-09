import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import DashboardProgram from '../../app/components/dashboard/DashboardProgram.vue'
import type { Enrollment } from '../../shared/types/program'

const { enrollment } = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return { enrollment: ref<Enrollment | null>(null) }
})
mockNuxtImport('useEnrollment', () => () => ({ enrollment }))

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

afterEach(() => {
  enrollment.value = null
})

describe('DashboardProgram', () => {
  it('links to the log with the week line, phase bar and next day', async () => {
    enrollment.value = base
    const wrapper = await mountSuspended(DashboardProgram)
    const card = wrapper.find('[data-test="dashboard-program"]')
    expect(card.attributes('href')).toBe('/workouts/log')
    expect(card.text()).toContain('BLS')
    expect(card.text()).toContain('Week 2 of 6 · Hypertrophy')
    expect(wrapper.findAll('[data-test="enrollment-segment"]')).toHaveLength(3)
    expect(wrapper.find('[data-test="dashboard-program-next"]').text()).toBe('Next: Upper A')
  })

  it('badges a deload and omits the next line when there is no next day', async () => {
    enrollment.value = { ...base, week: 5, phaseIndex: 1, phase: phases[1]!, nextDay: null }
    const wrapper = await mountSuspended(DashboardProgram)
    expect(wrapper.find('[data-test="dashboard-program"]').text()).toContain('Deload')
    expect(wrapper.find('[data-test="dashboard-program-next"]').exists()).toBe(false)
  })

  it('shows a paused program', async () => {
    enrollment.value = { ...base, status: 'paused', state: 'paused', nextDay: null }
    const wrapper = await mountSuspended(DashboardProgram)
    expect(wrapper.find('[data-test="dashboard-program"]').text()).toContain('Paused at week 2 of 6')
  })

  it('hides when there is no enrollment or it has finished', async () => {
    const none = await mountSuspended(DashboardProgram)
    expect(none.find('[data-test="dashboard-program"]').exists()).toBe(false)
    enrollment.value = {
      ...base,
      status: 'completed',
      state: 'finished',
      phase: null,
      phaseIndex: -1,
      notice: 'complete'
    }
    const done = await mountSuspended(DashboardProgram)
    expect(done.find('[data-test="dashboard-program"]').exists()).toBe(false)
  })
})
