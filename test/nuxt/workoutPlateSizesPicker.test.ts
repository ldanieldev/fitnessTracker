import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutPlateSizesPicker from '../../app/components/workout/WorkoutPlateSizesPicker.vue'

function lastModel(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  const events = wrapper.emitted('update:modelValue')!
  return events[events.length - 1]![0]
}

describe('WorkoutPlateSizesPicker', () => {
  it('shows choices and selected sizes heaviest first, pressed when selected', async () => {
    const wrapper = await mountSuspended(WorkoutPlateSizesPicker, {
      props: { modelValue: [55, 45], choices: [45, 25] }
    })
    const chips = wrapper.findAll('[data-test^="plate-chip-"]')
    expect(chips.map((chip) => chip.attributes('data-test'))).toEqual([
      'plate-chip-55',
      'plate-chip-45',
      'plate-chip-25'
    ])
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

  it('disables unselected chips once the maximum is selected', async () => {
    const twelve = [100, 55, 45, 35, 25, 15, 10, 5, 2.5, 1.25, 0.5, 0.25]
    const wrapper = await mountSuspended(WorkoutPlateSizesPicker, {
      props: { modelValue: twelve, choices: [...twelve, 20] }
    })
    const chip = wrapper.find('[data-test="plate-chip-20"]')
    expect(chip.attributes('disabled')).toBeDefined()
    await chip.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.find('[data-test="plate-chip-45"]').attributes('disabled')).toBeUndefined()
  })

  it('refuses a 13th size even when an unselected chip is clicked past its disabled state', async () => {
    const twelve = [100, 55, 45, 35, 25, 15, 10, 5, 2.5, 1.25, 0.5, 0.25]
    const wrapper = await mountSuspended(WorkoutPlateSizesPicker, {
      props: { modelValue: twelve, choices: [...twelve, 20] }
    })
    const chip = wrapper.findAllComponents({ name: 'UButton' }).find((button) => button.props('label') === '20')!
    chip.vm.$emit('click', new MouseEvent('click'))
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
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

  it('keeps a deselected custom size as a chip', async () => {
    const wrapper = await mountSuspended(WorkoutPlateSizesPicker, { props: { modelValue: [45, 1.25], choices: [45] } })
    await wrapper.find('[data-test="plate-chip-1.25"]').trigger('click')
    expect(lastModel(wrapper)).toEqual([45])
    await wrapper.setProps({ modelValue: [45] })
    expect(wrapper.find('[data-test="plate-chip-1.25"]').attributes('aria-pressed')).toBe('false')
  })

  it('keeps a size added here after it is deselected', async () => {
    const wrapper = await mountSuspended(WorkoutPlateSizesPicker, { props: { modelValue: [45], choices: [45] } })
    await wrapper.find('[data-test="plate-add-input"]').setValue('15')
    await wrapper.find('[data-test="plate-add"]').trigger('click')
    await wrapper.setProps({ modelValue: [45, 15] })
    await wrapper.setProps({ modelValue: [45] })
    expect(wrapper.find('[data-test="plate-chip-15"]').exists()).toBe(true)
  })

  it('says why a typed size was refused and clears the message on the next keystroke', async () => {
    const wrapper = await mountSuspended(WorkoutPlateSizesPicker, { props: { modelValue: [45], choices: [45] } })
    const input = wrapper.find('[data-test="plate-add-input"]')
    await input.setValue('0')
    await wrapper.find('[data-test="plate-add"]').trigger('click')
    expect(wrapper.find('[data-test="plate-add-error"]').text()).toBe('Enter a size from 0.01 to 100 lb')
    await input.setValue('1.234')
    expect(wrapper.find('[data-test="plate-add-error"]').exists()).toBe(false)
    await wrapper.find('[data-test="plate-add"]').trigger('click')
    expect(wrapper.find('[data-test="plate-add-error"]').text()).toBe('Use at most two decimals')
    await input.setValue('45')
    await wrapper.find('[data-test="plate-add"]').trigger('click')
    expect(wrapper.find('[data-test="plate-add-error"]').text()).toBe('45 lb is already selected')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
