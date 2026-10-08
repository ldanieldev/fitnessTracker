import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import WorkoutHistoryFilterSheet from '../../app/components/workout/WorkoutHistoryFilterSheet.vue'

const category = (id: number, key: string, color: string) => ({ id, key, name: key, color, sortOrder: id, shared: true, hidden: false })
registerEndpoint('/api/workouts/reference', () => ({
  categories: [category(1, 'chest', 'rose'), category(2, 'back', 'amber')], muscles: [], equipment: []
}))
registerEndpoint('/api/workouts/exercises/12', () => ({ id: 12, name: 'Assisted Dip', loadStyle: 'assisted' }))
registerEndpoint('/api/workouts/exercises/13', () => ({ id: 13, name: 'Bench Press', loadStyle: 'barbell' }))
registerEndpoint('/api/workouts/exercises/14', async () => {
  await new Promise((resolve) => setTimeout(resolve, 150))
  return { id: 14, name: 'Slow Row', loadStyle: 'plain' }
})

registerEndpoint('/api/workouts/programs', () => [
  { id: 7, name: 'BLS', phaseCount: 2, totalWeeks: 4, enrolled: true },
  { id: 8, name: 'Other', phaseCount: 1, totalWeeks: 2, enrolled: false },
  { id: 9, name: 'Slow', phaseCount: 1, totalWeeks: 1, enrolled: false }
])
registerEndpoint('/api/workouts/programs/9', async () => {
  await new Promise((resolve) => setTimeout(resolve, 150))
  return { id: 9, name: 'Slow', description: null, totalWeeks: 1, phases: [{ id: 90, name: 'Only', sortOrder: 0, weeks: 1, deload: false, routine: null }] }
})
registerEndpoint('/api/workouts/programs/7', () => ({
  id: 7, name: 'BLS', description: null, totalWeeks: 4,
  phases: [{ id: 70, name: 'Build', sortOrder: 0, weeks: 2, deload: false, routine: null }, { id: 71, name: 'Peak', sortOrder: 1, weeks: 2, deload: false, routine: null }]
}))
registerEndpoint('/api/workouts/programs/8', () => ({ id: 8, name: 'Other', description: null, totalWeeks: 2, phases: [] }))

const mount = (filter = {}) =>
  mountSuspended(WorkoutHistoryFilterSheet, { props: { open: true, filter }, attachTo: document.body })
const q = (sel: string) => document.querySelector<HTMLElement>(`[data-test="${sel}"]`)
function pickSelect(testId: string, value: number) {
  type Instance = { props?: { items?: unknown }, parent: Instance | null, emit: (event: string, value: number) => void }
  let node = (q(testId) as unknown as { __vueParentComponent: Instance | null }).__vueParentComponent
  while (node && !node.props?.items) node = node.parent
  node!.emit('update:modelValue', value)
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('WorkoutHistoryFilterSheet', () => {
  it('shows Any/All only with two or more categories and applies the pick', async () => {
    const wrapper = await mount()
    await flush()
    q('filter-category-1')!.click()
    await flush()
    expect(q('filter-match-all')).toBeNull()
    q('filter-category-2')!.click()
    await flush()
    q('filter-match-all')!.click()
    q('filter-apply')!.click()
    await flush()
    expect(wrapper.emitted('apply')?.at(-1)).toEqual([{ categories: [1, 2], match: 'all' }])
    wrapper.unmount()
  })

  it('disables thresholds until an exercise is chosen and labels assisted exercises', async () => {
    const none = await mount()
    await flush()
    expect(q('filter-min-weight')?.querySelector('input')?.disabled ?? (q('filter-min-weight') as HTMLInputElement).disabled).toBe(true)
    none.unmount()

    const assisted = await mount({ exerciseId: 12, minWeight: 20 })
    await flush()
    expect(document.body.textContent).toContain('Assisted Dip')
    expect(document.body.textContent).toContain('Max assist (lb)')
    assisted.unmount()

    const bench = await mount({ exerciseId: 13 })
    await flush()
    expect(document.body.textContent).toContain('Min weight (lb)')
    bench.unmount()
  })

  it('clear emits an empty filter', async () => {
    const wrapper = await mount({ categories: [1], exerciseId: 13, minReps: 5 })
    await flush()
    q('filter-clear')!.click()
    await flush()
    expect(wrapper.emitted('apply')?.at(-1)).toEqual([{}])
    wrapper.unmount()
  })

  it('keeps the exercise rule when the exercise fails to load', async () => {
    const wrapper = await mount({ exerciseId: 99, minWeight: 225 })
    q('filter-apply')!.click()
    await flush()
    expect(wrapper.emitted('apply')?.at(-1)).toEqual([{ exerciseId: 99, minWeight: 225 }])
    wrapper.unmount()
  })

  it('drops the old thresholds when a different exercise is picked but keeps them for the same one', async () => {
    const wrapper = await mount({ exerciseId: 13, minWeight: 225, minReps: 5 })
    await flush()
    const picker = wrapper.findComponent({ name: 'WorkoutExercisePicker' })
    picker.vm.$emit('pick', 13)
    await flush()
    q('filter-apply')!.click()
    await flush()
    expect(wrapper.emitted('apply')?.at(-1)).toEqual([{ exerciseId: 13, minWeight: 225, minReps: 5 }])
    wrapper.unmount()

    const other = await mount({ exerciseId: 13, minWeight: 225, minReps: 5 })
    await flush()
    other.findComponent({ name: 'WorkoutExercisePicker' }).vm.$emit('pick', 12)
    await flush()
    q('filter-apply')!.click()
    await flush()
    expect(other.emitted('apply')?.at(-1)).toEqual([{ exerciseId: 12 }])
    other.unmount()
  })

  it('keeps the saved phase on open and resets it only when the program changes', async () => {
    const wrapper = await mount({ programId: 7, phaseId: 71 })
    await flush()
    await flush()
    expect(q('filter-phase')).not.toBeNull()
    q('filter-apply')!.click()
    await flush()
    expect(wrapper.emitted('apply')?.at(-1)).toEqual([{ programId: 7, phaseId: 71 }])

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    await flush()
    pickSelect('filter-program', 8)
    await flush()
    await flush()
    q('filter-apply')!.click()
    await flush()
    expect(wrapper.emitted('apply')?.at(-1)).toEqual([{ programId: 8 }])
    wrapper.unmount()
  })

  it('drops the phase when the program is set back to any', async () => {
    const wrapper = await mount({ programId: 7, phaseId: 70 })
    await flush()
    pickSelect('filter-program', -1)
    await flush()
    q('filter-apply')!.click()
    await flush()
    expect(wrapper.emitted('apply')?.at(-1)).toEqual([{}])
    wrapper.unmount()
  })

  it('ignores a saved program that is no longer in the list', async () => {
    const wrapper = await mount({ programId: 99, phaseId: 990, categories: [1] })
    await flush()
    await flush()
    expect(q('filter-phase')).toBeNull()
    q('filter-apply')!.click()
    await flush()
    expect(wrapper.emitted('apply')?.at(-1)).toEqual([{ categories: [1] }])
    wrapper.unmount()
  })

  it('shows a disabled Loading phases placeholder until the program detail arrives', async () => {
    const wrapper = await mount({ programId: 9, phaseId: 90 })
    await flush()
    expect(q('filter-phase')?.hasAttribute('disabled')).toBe(true)
    expect(q('filter-phase')?.textContent).toContain('Loading phases…')
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(q('filter-phase')?.hasAttribute('disabled')).toBe(false)
    expect(q('filter-phase')?.textContent).toContain('Only')
    wrapper.unmount()
  })

  it('shows the last picked exercise even when an earlier lookup lands later', async () => {
    const wrapper = await mount({ exerciseId: 14 })
    wrapper.findComponent({ name: 'WorkoutExercisePicker' }).vm.$emit('pick', 13)
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(q('filter-exercise')?.textContent).toContain('Bench Press')
    wrapper.unmount()
  })

  it('labels the weight neutrally until the exercise is known', async () => {
    const failed = await mount({ exerciseId: 99, minWeight: 20 })
    await flush()
    expect(document.body.textContent).toContain('Weight (lb)')
    expect(document.body.textContent).not.toContain('Min weight (lb)')
    failed.unmount()

    const slow = await mount({ exerciseId: 14 })
    await flush()
    expect(document.body.textContent).toContain('Weight (lb)')
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(document.body.textContent).toContain('Min weight (lb)')
    slow.unmount()
  })

  it('shows a chip for a selected category the reference list lacks, and toggles it off', async () => {
    const wrapper = await mount({ categories: [1, 77] })
    await flush()
    expect(q('filter-category-77')?.textContent).toContain('Unknown category')
    q('filter-category-77')!.click()
    await flush()
    q('filter-apply')!.click()
    await flush()
    expect(wrapper.emitted('apply')?.at(-1)).toEqual([{ categories: [1] }])
    wrapper.unmount()
  })

  it('does not leave the phase select loading after the program goes to Any mid-fetch and back', async () => {
    const wrapper = await mount({ programId: 9 })
    await flush()
    pickSelect('filter-program', -1)
    await flush()
    pickSelect('filter-program', 9)
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(q('filter-phase')?.hasAttribute('disabled')).toBe(false)
    expect(q('filter-phase')?.textContent).not.toContain('Loading phases…')
    wrapper.unmount()
  })
})
