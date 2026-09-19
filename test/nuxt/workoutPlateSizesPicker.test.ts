import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutPlateSizesPicker from '../../app/components/workout/WorkoutPlateSizesPicker.vue'

function lastModel(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  const events = wrapper.emitted('update:modelValue')!
  return events[events.length - 1]![0]
}

describe('WorkoutPlateSizesPicker', () => {
  it('shows choices and selected sizes heaviest first, pressed when selected', async () => {
    const wrapper = await mountSuspended(WorkoutPlateSizesPicker, { props: { modelValue: [55, 45], choices: [45, 25] } })
    const chips = wrapper.findAll('[data-test^="plate-chip-"]')
    expect(chips.map((chip) => chip.attributes('data-test'))).toEqual(['plate-chip-55', 'plate-chip-45', 'plate-chip-25'])
    expect(wrapper.find('[data-test="plate-chip-25"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-test="plate-chip-55"]').attributes('aria-pressed')).toBe('true')
  })

  it('keeps the add field at the tap-target height', async () => {
    const wrapper = await mountSuspended(WorkoutPlateSizesPicker, { props: { modelValue: [45], choices: [45] } })
    expect(wrapper.find('[data-test="plate-add-input"]').classes()).toContain('min-h-10')
  })

  it('toggles a size on and off but never removes the last one', async () => {
    const wrapper = await mountSuspended(WorkoutPlateSizesPicker, { props: { modelValue: [45], choices: [45, 25] } })
    await wrapper.find('[data-test="plate-chip-25"]').trigger('click')
    expect(lastModel(wrapper)).toEqual([45, 25])
    await wrapper.setProps({ modelValue: [45] })
    expect(wrapper.find('[data-test="plate-chip-45"]').attributes('disabled')).toBeDefined()
  })

  it('adds a typed size and ignores an invalid one', async () => {
    const wrapper = await mountSuspended(WorkoutPlateSizesPicker, { props: { modelValue: [45], choices: [45] } })
    await wrapper.find('[data-test="plate-add-input"]').setValue('1.25')
    await wrapper.find('[data-test="plate-add"]').trigger('click')
    expect(lastModel(wrapper)).toEqual([45, 1.25])
    await wrapper.find('[data-test="plate-add-input"]').setValue('0')
    await wrapper.find('[data-test="plate-add"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
  })
})
