import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutProgramStatus from '../../app/components/workout/WorkoutProgramStatus.vue'
import type { Enrollment } from '../../shared/types/program'

const { enrollment, dismiss, toastAdd } = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return { enrollment: ref<Enrollment | null>(null), dismiss: vi.fn(), toastAdd: vi.fn() }
})
mockNuxtImport('useEnrollment', () => () => ({ enrollment, dismiss }))
mockNuxtImport('useToast', () => () => ({ add: toastAdd }))

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
const finished: Enrollment = {
  ...base,
  status: 'completed',
  state: 'finished',
  phase: null,
  phaseIndex: -1,
  notice: 'complete'
}

afterEach(() => {
  enrollment.value = null
  dismiss.mockReset()
  toastAdd.mockReset()
})

describe('WorkoutProgramStatus', () => {
  it('renders nothing without an enrollment', async () => {
    const wrapper = await mountSuspended(WorkoutProgramStatus)
    expect(wrapper.find('[data-test="program-status"]').exists()).toBe(false)
  })

  it('shows the status line and no banner when there is no notice', async () => {
    enrollment.value = base
    const wrapper = await mountSuspended(WorkoutProgramStatus)
    expect(wrapper.find('[data-test="program-banner"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="program-status-line"]').text()).toBe('BLS · Week 2 of 6 · Hypertrophy')
  })

  it('announces a new phase and its routine, with the deload badge', async () => {
    enrollment.value = { ...base, week: 5, phaseIndex: 1, phase: phases[1]!, notice: 'phase' }
    const wrapper = await mountSuspended(WorkoutProgramStatus)
    const banner = wrapper.find('[data-test="program-banner"]')
    expect(banner.text()).toContain('Deload started')
    expect(banner.text()).toContain('Upper/Lower is now your active routine.')
    expect(wrapper.find('[data-test="program-status-line"]').text()).toContain('Deload')
  })

  it('announces a rest week', async () => {
    enrollment.value = { ...base, week: 6, phaseIndex: 2, phase: phases[2]!, notice: 'phase' }
    const wrapper = await mountSuspended(WorkoutProgramStatus)
    expect(wrapper.find('[data-test="program-banner"]').text()).toContain('Rest week — no routine this week.')
    expect(wrapper.find('[data-test="program-status-line"]').text()).toContain('Rest week')
  })

  it('announces completion without a status line', async () => {
    enrollment.value = finished
    const wrapper = await mountSuspended(WorkoutProgramStatus)
    expect(wrapper.find('[data-test="program-banner"]').text()).toContain('BLS complete')
    expect(wrapper.find('[data-test="program-banner"]').text()).toContain('No routine is active now.')
    expect(wrapper.find('[data-test="program-status-line"]').exists()).toBe(false)
  })

  it('closing the banner dismisses the notice', async () => {
    enrollment.value = finished
    dismiss.mockResolvedValue(null)
    const wrapper = await mountSuspended(WorkoutProgramStatus)
    await wrapper.find('[data-test="program-banner"] [data-slot="close"]').trigger('click')
    await flushPromises()
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('a failed dismiss toasts with its own title', async () => {
    enrollment.value = finished
    dismiss.mockRejectedValue(new Error('offline'))
    const wrapper = await mountSuspended(WorkoutProgramStatus)
    await wrapper.find('[data-test="program-banner"] [data-slot="close"]').trigger('click')
    await flushPromises()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd.mock.calls[0]![0]).toMatchObject({ title: 'Couldn\'t dismiss notice', color: 'error' })
  })
})
