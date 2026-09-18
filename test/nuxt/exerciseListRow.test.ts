import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ExerciseListRow from '../../app/components/workout/ExerciseListRow.vue'

const base = {
  id: 7,
  name: 'Barbell Bench Press',
  category: { id: 1, key: 'chest', name: 'Chest', color: 'rose', sortOrder: 0, shared: true, hidden: false },
  trackingType: 'weight_reps' as const,
  loadStyle: 'barbell' as const,
  barWeight: 45,
  weightIncrement: null,
  restSeconds: null,
  difficulty: 'beginner' as const,
  equipment: ['barbell'],
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps'],
  images: ['Barbell_Bench_Press/0.jpg'],
  notes: null,
  link: null,
  favorite: false,
  hidden: false,
  shared: true,
  overridden: { category: false, trackingType: false, loadStyle: false, barWeight: false }
}

describe('ExerciseListRow', () => {
  it('shows the name, category and equipment, and links to the detail page', async () => {
    const wrapper = await mountSuspended(ExerciseListRow, { props: { exercise: base } })
    expect(wrapper.text()).toContain('Barbell Bench Press')
    expect(wrapper.text()).toContain('Barbell')
    expect(wrapper.find('a[data-test="exercise-link-7"]').attributes('href')).toBe('/workouts/exercises/7')
    expect(wrapper.find('[data-test="exercise-category-7"]').attributes('class')).toContain('rose')
  })

  it('stretches the link across the card so the whole left side opens the exercise', async () => {
    const wrapper = await mountSuspended(ExerciseListRow, { props: { exercise: base } })
    expect(wrapper.find('a[data-test="exercise-link-7"]').attributes('class')).toContain('after:inset-0')
    expect(wrapper.find('[data-test="exercise-row"]').attributes('class')).toContain('relative')
  })

  it('tints the star button for favourites instead of adding a second star', async () => {
    const plain = await mountSuspended(ExerciseListRow, { props: { exercise: base } })
    const plainStar = plain.find('[data-test="exercise-favorite-toggle-7"]')
    expect(plainStar.attributes('class')).not.toContain('amber')
    expect(plainStar.attributes('aria-label')).toBe('Favorite')
    const starred = await mountSuspended(ExerciseListRow, { props: { exercise: { ...base, favorite: true } } })
    const starredStar = starred.find('[data-test="exercise-favorite-toggle-7"]')
    expect(starredStar.attributes('class')).toContain('amber')
    expect(starredStar.attributes('aria-label')).toBe('Unfavorite')
  })

  it('offers fork on a catalogue exercise and edit on your own', async () => {
    const shared = await mountSuspended(ExerciseListRow, { props: { exercise: base } })
    expect(shared.find('[data-test="exercise-fork-7"]').exists()).toBe(true)
    expect(shared.find('[data-test="exercise-edit-7"]').exists()).toBe(false)
    const mine = await mountSuspended(ExerciseListRow, { props: { exercise: { ...base, shared: false } } })
    expect(mine.find('[data-test="exercise-edit-7"]').exists()).toBe(true)
  })

  it('emits favorite and hide from the menu actions', async () => {
    const wrapper = await mountSuspended(ExerciseListRow, { props: { exercise: base } })
    expect(wrapper.find('[data-test="exercise-hide-7"]').attributes('aria-label')).toBe('Hide')
    await wrapper.find('[data-test="exercise-favorite-toggle-7"]').trigger('click')
    await wrapper.find('[data-test="exercise-hide-7"]').trigger('click')
    expect(wrapper.emitted('favorite')).toEqual([[7]])
    expect(wrapper.emitted('hide')).toEqual([[7]])
  })

  it('offers unhide on a hidden exercise through the same button', async () => {
    const wrapper = await mountSuspended(ExerciseListRow, { props: { exercise: { ...base, hidden: true } } })
    const button = wrapper.find('[data-test="exercise-hide-7"]')
    expect(button.attributes('aria-label')).toBe('Unhide')
    await button.trigger('click')
    expect(wrapper.emitted('hide')).toEqual([[7]])
  })
})
