import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ExerciseVariationPicker from '../../app/components/workout/ExerciseVariationPicker.vue'

const category = { id: 1, key: 'chest', name: 'Chest', color: 'rose', sortOrder: 0, shared: true, hidden: false }
const exercise = (id: number, name: string) => ({
  id,
  name,
  category,
  trackingType: 'weight_reps' as const,
  loadStyle: 'barbell' as const,
  barWeight: 45,
  weightIncrement: null,
  restSeconds: null,
  plateSizes: null,
  difficulty: null,
  equipment: [],
  primaryMuscles: [],
  secondaryMuscles: [],
  images: [],
  notes: null,
  link: null,
  favorite: false,
  hidden: false,
  shared: true,
  overridden: { category: false, trackingType: false, loadStyle: false, barWeight: false },
  defaultGraph: null
})
const groups = [
  { id: 5, name: 'Bench family', exerciseIds: [21, 22] },
  { id: 6, name: 'Rows', exerciseIds: [30] }
]

// AppSheet teleports its body out of the mounted subtree, so query the attached document instead of wrapper.find.
function find(selector: string) {
  return new DOMWrapper(document.querySelector(selector))
}

// Cleanup lives in afterEach so a failing assertion can't leave a teleported sheet behind for the next test.
const mounted: Array<{ unmount: () => void }> = []
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

async function mount(target: ReturnType<typeof exercise>) {
  const wrapper = await mountSuspended(ExerciseVariationPicker, {
    attachTo: document.body,
    props: { open: true, exercise: target, groups }
  })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('ExerciseVariationPicker', () => {
  it('links an unlinked exercise to a group in one tap and closes', async () => {
    const wrapper = await mount(exercise(40, 'Back Squat'))
    await find('[data-test="variation-group-6"]').trigger('click')
    expect(wrapper.emitted('link')).toEqual([[{ groupId: 6, exerciseId: 40 }]])
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('disables and marks the current group', async () => {
    await mount(exercise(21, 'Bench Press'))
    expect(find('[data-test="variation-group-5"]').attributes('disabled')).toBeDefined()
    expect(find('[data-test="variation-group-5"]').text()).toContain('Current')
    expect(find('[data-test="variation-group-6"]').text()).not.toContain('Current')
  })

  it('asks before moving between groups and can back out', async () => {
    const wrapper = await mount(exercise(21, 'Bench Press'))
    await find('[data-test="variation-group-6"]').trigger('click')
    expect(document.body.textContent).toContain('Move Bench Press from Bench family to Rows?')
    expect(wrapper.emitted('link')).toBeUndefined()
    await find('[data-test="variation-move-cancel"]').trigger('click')
    expect(find('[data-test="variation-group-6"]').exists()).toBe(true)
    expect(wrapper.emitted('link')).toBeUndefined()
  })

  it('moves on confirm', async () => {
    const wrapper = await mount(exercise(21, 'Bench Press'))
    await find('[data-test="variation-group-6"]').trigger('click')
    await find('[data-test="variation-move-confirm"]').trigger('click')
    expect(wrapper.emitted('link')).toEqual([[{ groupId: 6, exerciseId: 21 }]])
  })

  it('creates a new group, prefilled with the exercise name', async () => {
    const wrapper = await mount(exercise(40, 'Back Squat'))
    await find('[data-test="variation-new"]').trigger('click')
    expect((find('[data-test="variation-name"]').element as HTMLInputElement).value).toBe('Back Squat')
    await find('[data-test="variation-name"]').setValue('Squat family')
    await find('[data-test="variation-save"]').trigger('click')
    expect(wrapper.emitted('link')).toEqual([[{ name: 'Squat family', exerciseId: 40 }]])
  })

  it('blocks a blank group name', async () => {
    await mount(exercise(40, 'Back Squat'))
    await find('[data-test="variation-new"]').trigger('click')
    await find('[data-test="variation-name"]').setValue('   ')
    expect(find('[data-test="variation-save"]').attributes('disabled')).toBeDefined()
  })
})
