import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import WorkoutHistoryFilterSheet from '../../app/components/workout/WorkoutHistoryFilterSheet.vue'

const category = (id: number, key: string, color: string) => ({ id, key, name: key, color, sortOrder: id, shared: true, hidden: false })
registerEndpoint('/api/workouts/reference', () => ({
  categories: [category(1, 'chest', 'rose'), category(2, 'back', 'amber')], muscles: [], equipment: []
}))
registerEndpoint('/api/workouts/exercises/12', () => ({ id: 12, name: 'Assisted Dip', loadStyle: 'assisted' }))
registerEndpoint('/api/workouts/exercises/13', () => ({ id: 13, name: 'Bench Press', loadStyle: 'barbell' }))

const mount = (filter = {}) =>
  mountSuspended(WorkoutHistoryFilterSheet, { props: { open: true, filter }, attachTo: document.body })
const q = (sel: string) => document.querySelector<HTMLElement>(`[data-test="${sel}"]`)
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
})
