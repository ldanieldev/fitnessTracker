import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutRoutineDayCard from '../../app/components/workout/WorkoutRoutineDayCard.vue'

const entry = {
  id: 5, exerciseId: 1, exerciseName: 'Plank', trackingType: 'time' as const, deleted: false, sortOrder: 0,
  target: { sets: 3, low: 30, high: 45, weight: null }, supersetGroup: null, optional: false, restSeconds: null, notes: null
}
const day = { id: 2, name: 'Push', description: null, floating: false, sortOrder: 0, entries: [entry] }
const props = { day, isDue: false, canMoveUp: false, canMoveDown: false }

describe('WorkoutRoutineDayCard', () => {
  it('makes the prescription chip part of a pointer-cursor tap target, with no chevron', async () => {
    const wrapper = await mountSuspended(WorkoutRoutineDayCard, { props })
    const open = wrapper.find('[data-test="routine-entry-open-5"]')
    expect(open.classes()).toContain('cursor-pointer')
    expect(open.find('[data-test="routine-entry-target-5"]').text()).toBe('3 × 0:30–0:45')
    expect(open.find('[class*="chevron-right"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="routine-entry-meta-5"]').exists()).toBe(false)
  })

  it('asks for targets when an exercise has none', async () => {
    const bare = { ...entry, target: null }
    const wrapper = await mountSuspended(WorkoutRoutineDayCard, { props: { ...props, day: { ...day, entries: [bare] } } })
    const chip = wrapper.find('[data-test="routine-entry-target-5"]')
    expect(chip.text()).toBe('Set targets')
    expect(chip.classes()).toContain('text-primary')
  })

  it('puts optional, rest and note on one quiet line under the name', async () => {
    const full = { ...entry, optional: true, restSeconds: 120, notes: 'per side' }
    const wrapper = await mountSuspended(WorkoutRoutineDayCard, { props: { ...props, day: { ...day, entries: [full] } } })
    expect(wrapper.find('[data-test="routine-entry-meta-5"]').text()).toBe('optional · 2:00 rest · per side')
  })

  it('offers Edit first in the row menu and it emits editEntry', async () => {
    const wrapper = await mountSuspended(WorkoutRoutineDayCard, { props })
    const menus = wrapper.findAllComponents({ name: 'UDropdownMenu' })
    const rowMenu = menus.find((m) => (m.props('items') as { testId?: string }[][])[0]!.some((i) => i.testId === 'routine-entry-edit-5'))!
    const first = (rowMenu.props('items') as { label: string, testId: string, onSelect: () => void }[][])[0]![0]!
    expect(first.label).toBe('Edit…')
    expect(first.testId).toBe('routine-entry-edit-5')
    first.onSelect()
    expect(wrapper.emitted('editEntry')![0]).toEqual([entry])
  })
})
