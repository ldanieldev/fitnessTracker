import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppNumberInput from '../../app/components/AppNumberInput.vue'

describe('AppNumberInput', () => {
  it('commits on every input event, not only on blur', async () => {
    const wrapper = await mountSuspended(AppNumberInput, { props: { modelValue: 1, 'data-test': 'qty' } })
    const input = wrapper.find('input[data-test="qty"]')
    await input.setValue('10')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([10])
    await input.setValue('10.')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([10])
    expect((input.element as HTMLInputElement).value).toBe('10.')
  })

  it('steps with the buttons and clamps at min', async () => {
    const wrapper = await mountSuspended(AppNumberInput, { props: { modelValue: 0.5, min: 0, step: 0.5 } })
    await wrapper.find('[aria-label="Decrease"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([0])
    await wrapper.find('[aria-label="Decrease"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([0])
  })

  it('keeps a cleared text while focused even if the model resets to 0, and syncs on blur', async () => {
    const wrapper = await mountSuspended(AppNumberInput, { props: { modelValue: 5, 'data-test': 'qty' } })
    const input = wrapper.find('input[data-test="qty"]')
    await input.trigger('focus')
    await input.setValue('')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
    await wrapper.setProps({ modelValue: 0 })
    expect((input.element as HTMLInputElement).value).toBe('')
    await input.trigger('blur')
    expect((input.element as HTMLInputElement).value).toBe('0')
  })
})
