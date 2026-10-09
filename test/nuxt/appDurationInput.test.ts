import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppDurationInput from '../../app/components/AppDurationInput.vue'

const field = (wrapper: Awaited<ReturnType<typeof mountSuspended>>) => wrapper.find('input[data-test="clock"]')

describe('AppDurationInput', () => {
  it('shows seconds as a clock', async () => {
    const wrapper = await mountSuspended(AppDurationInput, { props: { modelValue: 3930, 'data-test': 'clock' } })
    expect((field(wrapper).element as HTMLInputElement).value).toBe('1:05:30')
    expect(field(wrapper).attributes('inputmode')).toBe('numeric')
  })

  it('takes keypad digits and reformats on blur', async () => {
    const wrapper = await mountSuspended(AppDurationInput, { props: { modelValue: null, 'data-test': 'clock' } })
    await field(wrapper).trigger('focus')
    await field(wrapper).setValue('2530')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([1530])
    await wrapper.setProps({ modelValue: 1530 })
    expect((field(wrapper).element as HTMLInputElement).value).toBe('2530')
    await field(wrapper).trigger('blur')
    expect((field(wrapper).element as HTMLInputElement).value).toBe('25:30')
  })

  it('takes a typed clock and refuses a bad one', async () => {
    const wrapper = await mountSuspended(AppDurationInput, { props: { modelValue: null, 'data-test': 'clock' } })
    await field(wrapper).setValue('24:59')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([1499])
    await field(wrapper).setValue('1:75')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })

  it('steps by the given seconds and clamps at zero', async () => {
    const wrapper = await mountSuspended(AppDurationInput, {
      props: {
        modelValue: 20,
        step: 30,
        'data-test': 'clock',
        'onUpdate:modelValue': (value: number | null) => wrapper.setProps({ modelValue: value })
      }
    })
    await wrapper.find('[aria-label="Increase"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([50])
    await wrapper.find('[aria-label="Decrease"]').trigger('click')
    await wrapper.find('[aria-label="Decrease"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([0])
  })

  it('steps from the stored seconds', async () => {
    const wrapper = await mountSuspended(AppDurationInput, { props: { modelValue: 90.4, step: 30 } })
    await wrapper.find('[aria-label="Increase"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([120.4])
  })

  it('follows an outside change while not focused', async () => {
    const wrapper = await mountSuspended(AppDurationInput, { props: { modelValue: 60, 'data-test': 'clock' } })
    await wrapper.setProps({ modelValue: 1800 })
    expect((field(wrapper).element as HTMLInputElement).value).toBe('30:00')
  })

  it('keeps the seconds untouched until the field is edited', async () => {
    const wrapper = await mountSuspended(AppDurationInput, { props: { modelValue: 90.4, 'data-test': 'clock' } })
    await field(wrapper).trigger('focus')
    await field(wrapper).trigger('blur')
    await wrapper.setProps({ modelValue: 125.7 })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('forwards an explicit id to the input', async () => {
    const wrapper = await mountSuspended(AppDurationInput, { props: { modelValue: null, id: 'clock-id' } })
    expect(wrapper.find('input#clock-id').exists()).toBe(true)
  })
})
