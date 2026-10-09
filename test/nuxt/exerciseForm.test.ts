import { afterEach, describe, expect, it } from 'vitest'
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
  muscles: [
    { key: 'chest', name: 'Chest' },
    { key: 'triceps', name: 'Triceps' }
  ],
  equipment: [{ key: 'barbell', name: 'Barbell' }]
}

// AppSheet teleports its body out of the mounted subtree, so query the attached document instead of wrapper.find.
function find(selector: string) {
  return new DOMWrapper(document.querySelector(selector))
}

// Cleanup lives in afterEach so a failing assertion can't leave a teleported sheet behind for the next test.
const mounted: Array<{ unmount: () => void }> = []
async function mountForm({ props }: { props: Record<string, unknown> }) {
  const wrapper = await mountSuspended(ExerciseForm, { attachTo: document.body, props: props as never })
  mounted.push(wrapper)
  return wrapper
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

describe('ExerciseForm', () => {
  it('submits the filled fields', async () => {
    const wrapper = await mountForm({ props })
    await flushPromises()
    await find('[data-test="exercise-name"]').setValue('Board Press')
    await find('[data-test="exercise-muscle-chest"]').trigger('click')
    await find('[data-test="exercise-submit"]').trigger('click')
    expect(wrapper.emitted('submit')![0]![0]).toMatchObject({
      name: 'Board Press',
      categoryId: 1,
      primaryMuscles: ['chest']
    })
  })

  it('refuses to submit an empty name', async () => {
    const wrapper = await mountForm({ props })
    await flushPromises()
    await find('[data-test="exercise-submit"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(new DOMWrapper(document.body).text()).toContain('Name is required')
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
    await mountForm({ props: { ...props, exercise } })
    await flushPromises()
    expect((find('[data-test="exercise-name"]').element as HTMLInputElement).value).toBe('Board Press')
    expect(find('[data-test="exercise-muscle-chest"]').attributes('aria-pressed')).toBe('true')
  })

  it('shows the bar weight field only for the barbell load style', async () => {
    await mountForm({ props })
    await flushPromises()
    expect(find('[data-test="exercise-bar-weight"]').exists()).toBe(false)
    await find('[data-test="exercise-load-barbell"]').trigger('click')
    expect(find('[data-test="exercise-bar-weight"]').exists()).toBe(true)
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
    const wrapper = await mountForm({ props: { ...props, exercise } })
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
  })

  it('defaults a new weight exercise to plain load style and a null bar weight', async () => {
    const wrapper = await mountForm({ props })
    await flushPromises()
    await find('[data-test="exercise-name"]').setValue('New Move')
    await find('[data-test="exercise-submit"]').trigger('click')
    const payload = wrapper.emitted('submit')![0]![0] as Record<string, unknown>
    expect(payload).toMatchObject({ trackingType: 'weight_reps', loadStyle: 'plain', barWeight: null })
  })

  it('names each chip group with a fieldset legend', async () => {
    await mountForm({ props })
    await flushPromises()
    const legends = [...document.querySelectorAll('fieldset > legend')].map((el) => el.textContent?.trim())
    expect(legends).toEqual(['Load style', 'Equipment', 'Primary muscles', 'Secondary muscles'])
    expect(document.querySelector('fieldset [data-test="exercise-equipment-barbell"]')).not.toBeNull()
  })

  it('caps equipment at four picks', async () => {
    const equipment = ['bands', 'barbell', 'cable', 'dumbbell', 'kettlebells'].map((key) => ({ key, name: key }))
    const wrapper = await mountForm({ props: { ...props, equipment } })
    await flushPromises()
    for (const key of ['bands', 'barbell', 'cable', 'dumbbell']) {
      await find(`[data-test="exercise-equipment-${key}"]`).trigger('click')
    }
    expect(find('[data-test="exercise-equipment-kettlebells"]').attributes('disabled')).toBeDefined()
    await find('[data-test="exercise-name"]').setValue('Loaded Carry')
    await find('[data-test="exercise-submit"]').trigger('click')
    expect(wrapper.emitted('submit')![0]![0]).toMatchObject({ equipment: ['bands', 'barbell', 'cable', 'dumbbell'] })
  })

  it('moves a muscle picked as primary out of secondary and locks its secondary chip', async () => {
    const wrapper = await mountForm({ props })
    await flushPromises()
    await find('[data-test="exercise-secondary-chest"]').trigger('click')
    await find('[data-test="exercise-muscle-chest"]').trigger('click')
    expect(find('[data-test="exercise-secondary-chest"]').attributes('disabled')).toBeDefined()
    await find('[data-test="exercise-name"]').setValue('Fly')
    await find('[data-test="exercise-submit"]').trigger('click')
    expect(wrapper.emitted('submit')![0]![0]).toMatchObject({ primaryMuscles: ['chest'], secondaryMuscles: [] })
  })

  it('binds every field label to its control', async () => {
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
      equipment: [],
      primaryMuscles: [],
      secondaryMuscles: [],
      images: [],
      notes: null,
      link: null,
      favorite: false,
      hidden: false,
      shared: false,
      overridden: { category: false, trackingType: false, loadStyle: false, barWeight: false },
      defaultGraph: null
    }
    await mountForm({ props: { ...props, exercise } })
    await flushPromises()
    const controlFor = (text: string) => {
      const label = [...document.querySelectorAll('label')].find((el) => el.textContent?.trim() === text)
      return label?.htmlFor ? document.getElementById(label.htmlFor) : null
    }
    expect(controlFor('Name')).toBe(document.querySelector('[data-test="exercise-name"]'))
    expect(controlFor('Category')).toBe(document.querySelector('[data-test="exercise-category"]'))
    expect(controlFor('Tracking type')).toBe(document.querySelector('[data-test="exercise-tracking-type"]'))
    expect(controlFor('Bar weight')).toBe(document.querySelector('[data-test="exercise-bar-weight"]'))
    expect(controlFor('Notes')).toBe(document.querySelector('[data-test="exercise-notes"]'))
  })
})
