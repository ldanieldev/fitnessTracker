import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { USelect } from '#components'
import ExerciseSettingsPanel from '../../app/components/workout/ExerciseSettingsPanel.vue'

interface SelectProbe {
  props: (key: string) => unknown
  vm: { $emit: (event: string, value: unknown) => void }
}

const exercise = {
  id: 7,
  name: 'Barbell Bench Press',
  category: { id: 1, key: 'chest', name: 'Chest', color: 'rose', sortOrder: 0, shared: true, hidden: false },
  trackingType: 'weight_reps' as const,
  loadStyle: 'barbell' as const,
  barWeight: 45,
  weightIncrement: null,
  restSeconds: null,
  plateSizes: null,
  difficulty: 'beginner' as const,
  equipment: ['barbell'],
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps'],
  images: [],
  notes: null,
  link: null,
  favorite: false,
  hidden: false,
  shared: true,
  overridden: { category: false, trackingType: false, loadStyle: false, barWeight: false },
  defaultGraph: null
}

describe('ExerciseSettingsPanel', () => {
  it('shows the catalogue value and no reset until a field is overridden', async () => {
    const wrapper = await mountSuspended(ExerciseSettingsPanel, { props: { exercise } })
    expect((wrapper.find('[data-test="setting-bar-weight"]').element as HTMLInputElement).value).toBe('45')
    expect(wrapper.find('[data-test="reset-barWeight"]').exists()).toBe(false)
  })

  it('offers a reset once a field is overridden and emits the field name', async () => {
    const wrapper = await mountSuspended(ExerciseSettingsPanel, {
      props: { exercise: { ...exercise, barWeight: 35, overridden: { ...exercise.overridden, barWeight: true } } }
    })
    await wrapper.find('[data-test="reset-barWeight"]').trigger('click')
    expect(wrapper.emitted('reset')).toEqual([['barWeight']])
  })

  it('emits the changed field on save', async () => {
    const wrapper = await mountSuspended(ExerciseSettingsPanel, { props: { exercise } })
    await wrapper.find('[data-test="setting-bar-weight"]').setValue('35')
    await wrapper.find('[data-test="settings-save"]').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toMatchObject({ barWeight: 35 })
  })

  it('hides the bar weight field unless the load style is barbell', async () => {
    const wrapper = await mountSuspended(ExerciseSettingsPanel, {
      props: { exercise: { ...exercise, loadStyle: 'assisted', barWeight: null } }
    })
    expect(wrapper.find('[data-test="setting-bar-weight"]').exists()).toBe(false)
  })

  it('offers no load style at all for a tracking type without weight', async () => {
    const wrapper = await mountSuspended(ExerciseSettingsPanel, {
      props: { exercise: { ...exercise, trackingType: 'reps', loadStyle: null, barWeight: null } }
    })
    expect(wrapper.find('[data-test="setting-load-style"]').exists()).toBe(false)
  })

  it('emits no save when nothing changed', async () => {
    const wrapper = await mountSuspended(ExerciseSettingsPanel, { props: { exercise } })
    await wrapper.find('[data-test="settings-save"]').trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('clears a stale bar weight when the load style moves away from barbell', async () => {
    const wrapper = await mountSuspended(ExerciseSettingsPanel, { props: { exercise } })
    await wrapper.find('[data-test="setting-bar-weight"]').setValue('50')

    // data-test lands on USelect's inner trigger, not the wrapper root VTU sees, so match by item count.
    const selects = wrapper.findAllComponents(USelect) as unknown as SelectProbe[]
    const loadStyleSelect = selects.find((c) => (c.props('items') as unknown[]).length === 3)!
    loadStyleSelect.vm.$emit('update:modelValue', 'assisted')
    await nextTick()

    expect(wrapper.find('[data-test="setting-bar-weight"]').exists()).toBe(false)

    await wrapper.find('[data-test="settings-save"]').trigger('click')
    const patch = wrapper.emitted('save')![0]![0] as Record<string, unknown>
    expect(patch.loadStyle).toBe('assisted')
    expect(patch.barWeight).toBeNull()
  })

  it('changing tracking type to reps hides both load style and bar weight', async () => {
    const wrapper = await mountSuspended(ExerciseSettingsPanel, { props: { exercise } })
    const selects = wrapper.findAllComponents(USelect) as unknown as SelectProbe[]
    const trackingTypeSelect = selects.find((c) => (c.props('items') as unknown[]).length === 10)!
    trackingTypeSelect.vm.$emit('update:modelValue', 'reps')
    await nextTick()

    expect(wrapper.find('[data-test="setting-load-style"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="setting-bar-weight"]').exists()).toBe(false)

    await wrapper.find('[data-test="settings-save"]').trigger('click')
    const patch = wrapper.emitted('save')![0]![0] as Record<string, unknown>
    expect(patch.loadStyle).toBeNull()
    expect(patch.barWeight).toBeNull()
  })

  it('no longer carries the workout fields', async () => {
    const wrapper = await mountSuspended(ExerciseSettingsPanel, { props: { exercise } })
    expect(wrapper.find('[data-test="setting-plates"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="setting-rest-seconds"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="setting-weight-increment"]').exists()).toBe(false)
  })

  it('binds each field label to its control and keeps the dimmed label colour', async () => {
    const wrapper = await mountSuspended(ExerciseSettingsPanel, {
      props: { exercise, categories: [exercise.category] }
    })
    const labelFor = (text: string) => wrapper.findAll('label').find((el) => el.text() === text)!
    const controlFor = (text: string) => wrapper.element.querySelector(`[id="${labelFor(text).attributes('for')}"]`)
    expect(controlFor('Category')).toBe(wrapper.find('[data-test="setting-category"]').element)
    expect(controlFor('Tracking type')).toBe(wrapper.find('[data-test="setting-tracking-type"]').element)
    expect(controlFor('Load style')).toBe(wrapper.find('[data-test="setting-load-style"]').element)
    expect(controlFor('Bar weight')).toBe(wrapper.find('[data-test="setting-bar-weight"]').element)
    expect(labelFor('Category').classes()).toContain('text-dimmed')
    expect(labelFor('Category').classes()).not.toContain('text-default')
  })

  it('leaves barWeight out of the patch when it was and stays null', async () => {
    const back = { ...exercise.category, id: 2, key: 'back', name: 'Back' }
    const wrapper = await mountSuspended(ExerciseSettingsPanel, {
      props: {
        exercise: { ...exercise, loadStyle: 'plain' as const, barWeight: null },
        categories: [exercise.category, back]
      }
    })
    // data-test lands on USelect's inner trigger, not the wrapper root VTU sees, so match by item count.
    const selects = wrapper.findAllComponents(USelect) as unknown as SelectProbe[]
    const categorySelect = selects.find((c) => (c.props('items') as unknown[]).length === 2)!
    categorySelect.vm.$emit('update:modelValue', 2)
    await nextTick()
    await wrapper.find('[data-test="settings-save"]').trigger('click')
    expect(wrapper.emitted('save')![0]![0]).toEqual({ categoryId: 2 })
  })
})
