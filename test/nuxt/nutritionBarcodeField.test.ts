import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NutritionBarcodeField from '../../app/components/nutrition/NutritionBarcodeField.vue'

describe('NutritionBarcodeField', () => {
  it('opens the camera from the scan button and fills the field with a detected code', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
    const wrapper = await mountSuspended(NutritionBarcodeField, {
      props: { modelValue: '', inputTest: 'food-barcode' }
    })
    expect(wrapper.findComponent({ name: 'NutritionBarcodeCamera' }).exists()).toBe(false)

    await wrapper.find('[data-test="food-barcode-scan"]').trigger('click')
    const camera = wrapper.findComponent({ name: 'NutritionBarcodeCamera' })
    expect(camera.exists()).toBe(true)

    camera.vm.$emit('detected', '3017624010701')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([['3017624010701']])
    expect(wrapper.findComponent({ name: 'NutritionBarcodeCamera' }).exists()).toBe(false)
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  })

  it('closes the camera when the scan button is pressed again', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
    const wrapper = await mountSuspended(NutritionBarcodeField, {
      props: { modelValue: '', inputTest: 'food-barcode' }
    })

    await wrapper.find('[data-test="food-barcode-scan"]').trigger('click')
    await wrapper.find('[data-test="food-barcode-scan"]').trigger('click')

    expect(wrapper.findComponent({ name: 'NutritionBarcodeCamera' }).exists()).toBe(false)
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  })
})
