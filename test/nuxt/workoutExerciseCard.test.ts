import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutExerciseCard from '../../app/components/workout/WorkoutExerciseCard.vue'

const set = (id: number, weight: number, reps: number, records: { kind: 'weight_reps', previous: number | null }[] = []) => ({
  id, sortOrder: id, weight, reps, distanceMeters: null, durationSeconds: null, done: false, comment: null, records
})

const entry = {
  id: 9, exerciseId: 7, exerciseName: 'Barbell Bench Press', sortOrder: 0, trackingType: 'weight_reps' as const,
  loadStyle: 'barbell' as const, barWeight: 45, weightIncrement: 5, restSeconds: null, plateSizes: [45, 35, 25, 10, 5, 2.5],
  notes: null, target: null, supersetGroup: null, optional: false, restOverrideSeconds: null, sets: [set(1, 185, 8), set(2, 205, 6, [{ kind: 'weight_reps', previous: 185 }])],
  lastSets: [{ weight: 175, reps: 8 }, { weight: 175, reps: 6 }]
}

const mount = (props: Record<string, unknown> = {}) =>
  mountSuspended(WorkoutExerciseCard, { props: { entry, isFirst: true, isLast: false, ...props } })

afterEach(() => {
  document.body.innerHTML = ''
})

describe('WorkoutExerciseCard', () => {
  it('names the exercise, links to it, badges the set count and lists one row per set plus the form', async () => {
    const wrapper = await mount()
    expect(wrapper.find('a[data-test="entry-link-9"]').attributes('href')).toBe('/workouts/exercises/7')
    expect(wrapper.find('[data-test="entry-sets-9"]').text()).toBe('2 sets')
    expect(wrapper.findAll('[data-test="set-row"]')).toHaveLength(2)
    expect(wrapper.find('[data-test="set-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="set-form-heading"]').text()).toBe('Set 3')
  })

  it('totals the volume of the logged sets', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-test="entry-volume-9"]').text()).toBe('Total Volume: 2,710 lb')
    const empty = await mount({ entry: { ...entry, sets: [] } })
    expect(empty.find('[data-test="entry-volume-9"]').exists()).toBe(false)
  })

  it('collapses and expands the body', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-test="entry-collapse-9"]').trigger('click')
    expect(wrapper.find('[data-test="set-form"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-test="set-row"]')).toHaveLength(0)
    await wrapper.find('[data-test="entry-collapse-9"]').trigger('click')
    expect(wrapper.find('[data-test="set-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="entry-history-9"]').classes()).toContain('max-sm:hidden')
    expect(wrapper.find('[data-test="entry-history-9"]').attributes('href')).toBe('/workouts/exercises/7?tab=history')
  })

  it('summarises last time under the name, and omits the line without one', async () => {
    const wrapper = await mount()
    expect(wrapper.findAll('[data-test="entry-last-set"]').map((n) => n.text())).toEqual(['175 lb × 8', '175 lb × 6'])
    const fresh = await mount({ entry: { ...entry, lastSets: [], loadStyle: 'plain', barWeight: null, plateSizes: null } })
    expect(fresh.find('[data-test="entry-last-9"]').exists()).toBe(false)
  })

  it('moves and removes from the menu, asking before removing', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-test="entry-menu-9"]').trigger('click')
    await document.body.querySelector<HTMLElement>('[data-test="entry-down-9"]')!.click()
    expect(wrapper.emitted('move')).toEqual([[1]])
    // Reka only registers the close on the next tick; clicking the trigger sooner toggles the still-open menu shut.
    await nextTick()
    await wrapper.find('[data-test="entry-menu-9"]').trigger('click')
    await document.body.querySelector<HTMLElement>('[data-test="entry-remove-9"]')!.click()
    await nextTick()
    expect(wrapper.emitted('remove')).toBeUndefined()
    await document.body.querySelector<HTMLElement>('[data-test="entry-remove-confirm-9"]')!.click()
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('disables moving up on the first card and moving down on the last', async () => {
    const first = await mount()
    await first.find('[data-test="entry-menu-9"]').trigger('click')
    expect(document.body.querySelector('[data-test="entry-up-9"]')!.closest('[role="menuitem"]')!.getAttribute('aria-disabled')).toBe('true')
    document.body.innerHTML = ''
    const last = await mount({ isFirst: false, isLast: true })
    await last.find('[data-test="entry-menu-9"]').trigger('click')
    expect(document.body.querySelector('[data-test="entry-down-9"]')!.closest('[role="menuitem"]')!.getAttribute('aria-disabled')).toBe('true')
  })

  it('puts a History item at the top of the menu, hidden above the sm breakpoint', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-test="entry-menu-9"]').trigger('click')
    const historyItem = document.body.querySelector('[data-test="entry-history-menu-9"]')!.closest('[role="menuitem"]')!
    expect(historyItem.classList.contains('sm:hidden')).toBe(true)
    expect(historyItem.getAttribute('href')).toBe('/workouts/exercises/7?tab=history')
  })

  it('emits addSet from the form and editSet / removeSet from a row', async () => {
    const wrapper = await mount()
    await wrapper.find('[data-test="set-weight-new"]').setValue('215')
    await wrapper.find('[data-test="set-save-new"]').trigger('click')
    expect(wrapper.emitted('addSet')![0]![0]).toMatchObject({ weight: 215 })
    await wrapper.find('[data-test="set-menu-1"]').trigger('click')
    await document.body.querySelector<HTMLElement>('[data-test="set-remove-1"]')!.click()
    expect(wrapper.emitted('removeSet')).toEqual([[1]])
  })

  it('shows a failed save beside the set it belongs to, and a failed add under the form', async () => {
    const wrapper = await mount({ saveErrors: { '2': 'Nope', 'new': 'Also nope' } })
    expect(wrapper.find('[data-test="set-save-error-2"]').text()).toContain('Nope')
    expect(wrapper.find('[data-test="set-save-error-new"]').text()).toContain('Also nope')
    await wrapper.find('[data-test="set-retry-2"]').trigger('click')
    await wrapper.find('[data-test="set-retry-new"]').trigger('click')
    expect(wrapper.emitted('retrySave')).toEqual([[2], [null]])
  })

  it('opens plates from the bar caption with the form\'s prefill weight, only when the page asks for it', async () => {
    const wrapper = await mount({ plateButton: true })
    await wrapper.find('[data-test="entry-plates-9"]').trigger('click')
    expect(wrapper.emitted('plates')).toEqual([[205]])
    const silent = await mount()
    expect(silent.find('[data-test="entry-plates-9"]').exists()).toBe(false)
  })

  it('shows target progress instead of the set count, plus optional and note', async () => {
    const wrapper = await mount({
      entry: { ...entry, target: { sets: 3, low: 5, high: 8, weight: null }, optional: true, notes: 'per side' }
    })
    expect(wrapper.find('[data-test="entry-target-9"]').text()).toBe('2 of 3 · 5–8')
    expect(wrapper.find('[data-test="entry-sets-9"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="entry-optional-9"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="entry-notes-9"]').text()).toBe('per side')
  })

  it('labels a superset member and bands the card', async () => {
    const wrapper = await mount({
      entry: { ...entry, supersetGroup: 1 }, supersetLabel: 'A2', supersetBorderClass: 'border-l-sky-500'
    })
    expect(wrapper.find('[data-test="entry-superset-9"]').text()).toBe('A2')
    expect(wrapper.find('[data-test="entry-card-9"]').classes()).toContain('border-l-sky-500')
  })

  it('collapses from the parent', async () => {
    const wrapper = await mount({ collapsed: true })
    expect(wrapper.find('[data-test="set-form"]').exists()).toBe(false)
  })
})
