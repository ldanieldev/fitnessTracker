import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import NutritionBarcodeScanner from '../../app/components/nutrition/NutritionBarcodeScanner.vue'

const { navigateToMock, toastAddMock } = vi.hoisted(() => ({ navigateToMock: vi.fn(), toastAddMock: vi.fn() }))
mockNuxtImport('navigateTo', () => navigateToMock)
mockNuxtImport('useToast', () => () => ({ add: toastAddMock }))

function stubSecureContext(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true })
}

function stubMediaDevices(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
}

describe('NutritionBarcodeScanner', () => {
  afterEach(() => {
    navigateToMock.mockClear()
    toastAddMock.mockClear()
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  })

  it('shows an HTTPS explanation and no video when the context is insecure', async () => {
    stubSecureContext(false)

    const wrapper = await mountSuspended(NutritionBarcodeScanner, { props: { date: '2026-01-01' } })
    await flushPromises()

    expect(wrapper.find('[data-test="scan-https-notice"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('HTTPS')
    expect(wrapper.find('[data-test="scan-video"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="scan-manual-input"]').exists()).toBe(true)
  })

  it('shows a camera permission message when getUserMedia rejects with NotAllowedError', async () => {
    stubSecureContext(true)
    stubMediaDevices(() => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })))

    const wrapper = await mountSuspended(NutritionBarcodeScanner, { props: { date: '2026-01-01' } })
    await flushPromises()

    expect(wrapper.find('[data-test="scan-permission-notice"]').exists()).toBe(true)
    expect(wrapper.text().toLowerCase()).toContain('camera permission')
    expect(wrapper.find('[data-test="scan-video"]').exists()).toBe(false)
  })

  it('allows a second manual lookup after the first one latches the scanner (P2-R30)', async () => {
    stubSecureContext(false)
    let lookupCalls = 0
    registerEndpoint('/api/nutrition/foods/barcode/3017624010701', () => {
      lookupCalls++
      return {
        found: 'off',
        external: {
          source: 'off',
          externalId: '3017624010701',
          name: 'Nutella',
          brand: 'Ferrero',
          barcode: '3017624010701',
          per100g: null,
          servingGrams: null,
          servingLabel: null,
          attribution: null
        }
      }
    })
    registerEndpoint('/api/nutrition/foods/barcode/0000000000000', () => {
      lookupCalls++
      throw createError({ statusCode: 404, statusMessage: 'Barcode not found', data: { barcode: '0000000000000' } })
    })

    const wrapper = await mountSuspended(NutritionBarcodeScanner, { props: { date: '2026-01-01' } })
    await flushPromises()

    await wrapper.find('[data-test="scan-manual-input"]').setValue('3017624010701')
    await wrapper.find('[data-test="scan-manual-submit"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="scan-external-card"]').exists()).toBe(true)

    await wrapper.find('[data-test="scan-manual-input"]').setValue('0000000000000')
    await wrapper.find('[data-test="scan-manual-submit"]').trigger('click')
    await flushPromises()

    expect(lookupCalls).toBe(2)
    expect(navigateToMock).toHaveBeenCalledWith(
      '/nutrition/diary/2026-01-01/foods/new?barcode=0000000000000',
      { replace: true }
    )
  })

  it('navigates with needsNutrition=1 when importing an external hit needs nutrition (P2-R29)', async () => {
    stubSecureContext(false)
    registerEndpoint('/api/nutrition/foods/barcode/3017624010701', () => ({
      found: 'off',
      external: {
        source: 'off',
        externalId: '3017624010701',
        name: 'Nutella',
        brand: 'Ferrero',
        barcode: '3017624010701',
        per100g: null,
        servingGrams: null,
        servingLabel: null,
        attribution: null
      }
    }))
    registerEndpoint('/api/nutrition/foods/import', {
      method: 'POST',
      handler: async () => ({ id: 55, needsNutrition: true, owned: false })
    })

    const wrapper = await mountSuspended(NutritionBarcodeScanner, { props: { date: '2026-01-01' } })
    await flushPromises()

    await wrapper.find('[data-test="scan-manual-input"]').setValue('3017624010701')
    await wrapper.find('[data-test="scan-manual-submit"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-test="scan-import"]').trigger('click')
    await flushPromises()

    expect(navigateToMock).toHaveBeenCalledWith(
      '/nutrition/diary/2026-01-01/add?foodId=55&needsNutrition=1',
      { replace: true }
    )
  })

  it('toasts once when the missing-barcode lookup carries source errors (P2-R31.5)', async () => {
    stubSecureContext(false)
    registerEndpoint('/api/nutrition/foods/barcode/3017624010701', () => {
      throw createError({
        statusCode: 404,
        statusMessage: 'Barcode not found',
        data: {
          barcode: '3017624010701',
          errors: [{ source: 'usda', kind: 'rate_limited', message: 'too many requests' }]
        }
      })
    })

    const wrapper = await mountSuspended(NutritionBarcodeScanner, { props: { date: '2026-01-01' } })
    await flushPromises()

    await wrapper.find('[data-test="scan-manual-input"]').setValue('3017624010701')
    await wrapper.find('[data-test="scan-manual-submit"]').trigger('click')
    await flushPromises()

    expect(toastAddMock).toHaveBeenCalledTimes(1)
    expect(toastAddMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Barcode sources unavailable' }))
    expect(navigateToMock).toHaveBeenCalledWith(
      '/nutrition/diary/2026-01-01/foods/new?barcode=3017624010701',
      { replace: true }
    )
  })

  // Drives the race via manual entry (controllable lookup promise); happy-dom can't run the camera frame loop.
  it('does not navigate if the component unmounts while the lookup is still in flight', async () => {
    stubSecureContext(false)
    let resolveLookup: (value: unknown) => void = () => {}
    const lookupPromise = new Promise((resolve) => {
      resolveLookup = resolve
    })
    registerEndpoint('/api/nutrition/foods/barcode/3017624010701', () => lookupPromise)

    const wrapper = await mountSuspended(NutritionBarcodeScanner, { props: { date: '2026-01-01' } })
    await flushPromises()

    await wrapper.find('[data-test="scan-manual-input"]').setValue('3017624010701')
    await wrapper.find('[data-test="scan-manual-submit"]').trigger('click')
    await flushPromises()

    wrapper.unmount()
    resolveLookup({ found: 'local', foodId: 42 })
    await flushPromises()
    await flushPromises()

    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('stops the camera tracks when unmounted while getUserMedia is still pending', async () => {
    stubSecureContext(true)
    const stop = vi.fn()
    let grant: (stream: MediaStream) => void = () => {}
    stubMediaDevices(() => new Promise((resolve) => (grant = resolve)))

    const wrapper = await mountSuspended(NutritionBarcodeScanner, { props: { date: '2026-01-01' } })
    await flushPromises()
    wrapper.unmount()
    grant({ getTracks: () => [{ stop }] } as unknown as MediaStream)
    await flushPromises()

    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('stops scanning and shows the manual-entry hint once when frames keep failing', async () => {
    stubSecureContext(true)
    const stop = vi.fn()
    stubMediaDevices(() => Promise.resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream))
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const srcObject = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject')
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { set: () => {}, configurable: true })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { get: () => 640, configurable: true })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { get: () => 480, configurable: true })
    const drawImage = vi.fn(() => {
      throw new Error('frame failed')
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage
    } as unknown as CanvasRenderingContext2D)

    const wrapper = await mountSuspended(NutritionBarcodeScanner, { props: { date: '2026-01-01' } })
    await vi.waitFor(() => expect(wrapper.find('[data-test="scan-permission-notice"]').exists()).toBe(true))
    await new Promise((resolve) => setTimeout(resolve, 600))

    expect(drawImage).toHaveBeenCalledTimes(1)
    expect(stop).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-test="scan-permission-notice"]').text()).toContain('manual entry')
    expect(wrapper.find('[data-test="scan-manual-input"]').exists()).toBe(true)
    wrapper.unmount()
    vi.restoreAllMocks()
    Reflect.deleteProperty(HTMLVideoElement.prototype, 'videoWidth')
    Reflect.deleteProperty(HTMLVideoElement.prototype, 'videoHeight')
    if (srcObject) Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', srcObject)
    else Reflect.deleteProperty(HTMLMediaElement.prototype, 'srcObject')
  })
})
