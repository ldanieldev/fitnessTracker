import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { USelect } from '#components'
import ExerciseForm from '../../app/components/workout/ExerciseForm.vue'

interface SelectProbe {
  props: (key: string) => unknown
  vm: { $emit: (event: string, value: unknown) => void }
}

const props = {
  open: true,
  categories: [{ id: 1, key: 'chest', name: 'Chest', color: 'rose', sortOrder: 0, shared: true, hidden: false }],
  muscles: [{ key: 'chest', name: 'Chest' }, { key: 'triceps', name: 'Triceps' }],
  equipment: [{ key: 'barbell', name: 'Barbell' }]
}

// AppSheet teleports its body out of the mounted subtree, so query the attached document instead of wrapper.find.
function find(selector: string) {
  return new DOMWrapper(document.querySelector(selector))
}

describe('ExerciseForm', () => {
  it('submits the filled fields', async () => {
    const wrapper = await mountSuspended(ExerciseForm, { attachTo: document.body, props })
    await flushPromises()
    await find('[data-test="exercise-name"]').setValue('Board Press')
    await find('[data-test="exercise-muscle-chest"]').trigger('click')
    await find('[data-test="exercise-submit"]').trigger('click')
    expect(wrapper.emitted('submit')![0]![0]).toMatchObject({
      name: 'Board Press', categoryId: 1, primaryMuscles: ['chest']
    })
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('refuses to submit an empty name', async () => {
    const wrapper = await mountSuspended(ExerciseForm, { attachTo: document.body, props })
    await flushPromises()
    await find('[data-test="exercise-submit"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(new DOMWrapper(document.body).text()).toContain('Name is required')
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('pre-fills when editing an existing exercise', async () => {
    const exercise = {
      id: 9,
      name: 'Board Press',
      category: props.categories[0]!,
      trackingType: 'weight_reps' as const,
      loadStyle: 'barbell' as const,
      barWeight: 45,
      weightIncrement: null,
      restSeconds: null,
      plateSizes: null,
      difficulty: null,
      equipment: ['barbell'],
      primaryMuscles: ['chest'],
      secondaryMuscles: ['triceps'],
      images: [],
      notes: null,
      link: null,
      favorite: false,
      hidden: false,
      shared: false,
      overridden: { category: false, trackingType: false, loadStyle: false, barWeight: false },
      defaultGraph: null
    }
    const wrapper = await mountSuspended(ExerciseForm, { attachTo: document.body, props: { ...props, exercise } })
    await flushPromises()
    expect((find('[data-test="exercise-name"]').element as HTMLInputElement).value).toBe('Board Press')
    expect(find('[data-test="exercise-muscle-chest"]').attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('shows the bar weight field only for the barbell load style', async () => {
    const wrapper = await mountSuspended(ExerciseForm, { attachTo: document.body, props })
    await flushPromises()
    expect(find('[data-test="exercise-bar-weight"]').exists()).toBe(false)
    await find('[data-test="exercise-load-barbell"]').trigger('click')
    expect(find('[data-test="exercise-bar-weight"]').exists()).toBe(true)
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('nulls loadStyle and barWeight when the tracking type moves away from weight-bearing', async () => {
    const exercise = {
      id: 9,
      name: 'Board Press',
      category: props.categories[0]!,
      trackingType: 'weight_reps' as const,
      loadStyle: 'barbell' as const,
      barWeight: 45,
      weightIncrement: null,
      restSeconds: null,
      plateSizes: null,
      difficulty: null,
      equipment: ['barbell'],
      primaryMuscles: ['chest'],
      secondaryMuscles: ['triceps'],
      images: [],
      notes: null,
      link: null,
      favorite: false,
      hidden: false,
      shared: false,
      overridden: { category: false, trackingType: false, loadStyle: false, barWeight: false },
      defaultGraph: null
    }
    const wrapper = await mountSuspended(ExerciseForm, { attachTo: document.body, props: { ...props, exercise } })
    await flushPromises()
    // data-test lands on USelect's inner trigger, not the wrapper root VTU sees, so match by item count.
    const selects = wrapper.findAllComponents(USelect) as unknown as SelectProbe[]
    const trackingTypeSelect = selects.find((c) => (c.props('items') as unknown[]).length === 10)!
    trackingTypeSelect.vm.$emit('update:modelValue', 'reps')
    await nextTick()
    await find('[data-test="exercise-submit"]').trigger('click')
    const payload = wrapper.emitted('submit')![0]![0] as Record<string, unknown>
    expect(payload.loadStyle).toBeNull()
    expect(payload.barWeight).toBeNull()
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('defaults a new weight exercise to plain load style and a null bar weight', async () => {
    const wrapper = await mountSuspended(ExerciseForm, { attachTo: document.body, props })
    await flushPromises()
    await find('[data-test="exercise-name"]').setValue('New Move')
    await find('[data-test="exercise-submit"]').trigger('click')
    const payload = wrapper.emitted('submit')![0]![0] as Record<string, unknown>
    expect(payload).toMatchObject({ trackingType: 'weight_reps', loadStyle: 'plain', barWeight: null })
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
