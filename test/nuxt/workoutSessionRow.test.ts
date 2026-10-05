import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutSessionRow from '../../app/components/workout/WorkoutSessionRow.vue'

const summary = {
  id: 9, name: 'Push A', performedOn: '2026-10-03', startedAt: '2026-10-03T15:00:00.000Z',
  endedAt: '2026-10-03T15:52:00.000Z', exerciseCount: 2, setCount: 6, categories: [], program: null
}

describe('WorkoutSessionRow', () => {
  it('links to the workout and summarises it', async () => {
    const wrapper = await mountSuspended(WorkoutSessionRow, { props: { summary } })
    expect(wrapper.find('a[data-test="session-link-9"]').attributes('href')).toBe('/workouts/sessions/9')
    expect(wrapper.text()).toContain('Push A')
    expect(wrapper.text()).toContain('Sat, Oct 3 · 2 exercises · 6 sets · 52:00')
  })

  it('shows a neutral phase and week chip only for program workouts', async () => {
    const plain = await mountSuspended(WorkoutSessionRow, { props: { summary } })
    expect(plain.find('[data-test="session-program-9"]').exists()).toBe(false)
    const tagged = await mountSuspended(WorkoutSessionRow, {
      props: { summary: { ...summary, program: { phaseId: 4, phaseName: 'Peak', phaseIndex: 1, week: 3 } } }
    })
    const chip = tagged.find('[data-test="session-program-9"]')
    expect(chip.text()).toBe('P2 · W3')
    expect(chip.attributes('class')).not.toContain('primary')
  })

  it('emits copy with the id', async () => {
    const wrapper = await mountSuspended(WorkoutSessionRow, { props: { summary } })
    await wrapper.find('[data-test="session-copy-9"]').trigger('click')
    expect(wrapper.emitted('copy')).toEqual([[9]])
  })

  it('offers Share in the menu', async () => {
    const wrapper = await mountSuspended(WorkoutSessionRow, { props: { summary }, attachTo: document.body })
    await wrapper.find('[data-test="session-menu-9"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const share = document.querySelector<HTMLElement>('[data-test="session-share-9"]')
    expect(share).not.toBeNull()
    wrapper.unmount()
  })
})
