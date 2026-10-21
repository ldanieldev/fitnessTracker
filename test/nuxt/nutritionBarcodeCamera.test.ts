import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NutritionBarcodeCamera from '../../app/components/nutrition/NutritionBarcodeCamera.vue'

describe('NutritionBarcodeCamera', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(window, 'BarcodeDetector')
    Reflect.deleteProperty(HTMLVideoElement.prototype, 'videoWidth')
    Reflect.deleteProperty(HTMLVideoElement.prototype, 'videoHeight')
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  })

  it('emits the normalized code once and stops the camera after a detector hit', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    const stop = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream) },
      configurable: true
    })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const srcObject = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject')
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { set: () => {}, configurable: true })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { get: () => 640, configurable: true })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { get: () => 480, configurable: true })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => {}
    } as unknown as CanvasRenderingContext2D)
    const detect = vi.fn(async () => [{ format: 'ean_13', rawValue: '3017624010701' }])
    Object.defineProperty(window, 'BarcodeDetector', {
      value: Object.assign(
        vi.fn(function () {
          return { detect }
        }),
        { getSupportedFormats: async () => ['ean_13'] }
      ),
      configurable: true
    })

    const wrapper = await mountSuspended(NutritionBarcodeCamera)
    await vi.waitFor(() => expect(wrapper.emitted('detected')).toBeTruthy())
    await new Promise((resolve) => setTimeout(resolve, 600))

    expect(wrapper.emitted('detected')).toEqual([['3017624010701']])
    expect(stop).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    if (srcObject) Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', srcObject)
    else Reflect.deleteProperty(HTMLMediaElement.prototype, 'srcObject')
  })

  it('names the fallback it is given when the camera is unavailable', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => Promise.reject(new Error('no camera')) },
      configurable: true
    })

    const wrapper = await mountSuspended(NutritionBarcodeCamera, { props: { fallback: 'type the barcode instead' } })
    await vi.waitFor(() => expect(wrapper.find('[data-test="scan-permission-notice"]').exists()).toBe(true))

    expect(wrapper.find('[data-test="scan-permission-notice"]').text()).toContain('type the barcode instead')
  })
})
