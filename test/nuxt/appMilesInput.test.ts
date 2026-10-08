import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppMilesInput from '../../app/components/AppMilesInput.vue'

describe('AppMilesInput', () => {
  it('shows metres as miles', async () => {
    const wrapper = await mountSuspended(AppMilesInput, { props: { modelValue: 5000, 'data-test': 'dist' } })
    expect((wrapper.find('input[data-test="dist"]').element as HTMLInputElement).value).toBe('3.11')
  })

  it('emits metres for typed miles', async () => {
    const wrapper = await mountSuspended(AppMilesInput, { props: { modelValue: null, 'data-test': 'dist' } })
    await wrapper.find('input[data-test="dist"]').setValue('3.1')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([4988.97])
    await wrapper.find('input[data-test="dist"]').setValue('')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })

  it('steps in miles and never below zero', async () => {
    const wrapper = await mountSuspended(AppMilesInput, { props: { modelValue: 1609.344, step: 0.1 } })
    await wrapper.find('[aria-label="Increase"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([1770.27])
    await wrapper.setProps({ modelValue: 80 })
    await wrapper.find('[aria-label="Decrease"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([0])
  })

  it('steps from the stored metres, not the rounded display', async () => {
    const wrapper = await mountSuspended(AppMilesInput, { props: { modelValue: 100, step: 0.1 } })
    await wrapper.find('[aria-label="Increase"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([260.93])
  })

  it('has no steppers without a step', async () => {
    const wrapper = await mountSuspended(AppMilesInput, { props: { modelValue: null } })
    expect(wrapper.find('[aria-label="Increase"]').exists()).toBe(false)
  })

  it('keeps the metres untouched until the field is edited', async () => {
    const wrapper = await mountSuspended(AppMilesInput, { props: { modelValue: 100, 'data-test': 'dist' } })
    const input = wrapper.find('input[data-test="dist"]')
    expect((input.element as HTMLInputElement).value).toBe('0.06')
    await input.trigger('focus')
    await input.trigger('blur')
    await wrapper.setProps({ modelValue: 200 })
    expect((input.element as HTMLInputElement).value).toBe('0.12')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await input.setValue('0.06')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([96.56])
  })

  it('forwards an explicit id to the input', async () => {
    const wrapper = await mountSuspended(AppMilesInput, { props: { modelValue: null, id: 'dist-id' } })
    expect(wrapper.find('input#dist-id').exists()).toBe(true)
  })
})
