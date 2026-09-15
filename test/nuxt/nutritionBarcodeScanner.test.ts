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
          source: 'off', externalId: '3017624010701', name: 'Nutella', brand: 'Ferrero', barcode: '3017624010701',
          per100g: null, servingGrams: null, servingLabel: null, attribution: null
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
    expect(navigateToMock).toHaveBeenCalledWith('/diary/2026-01-01/foods/new?barcode=0000000000000')
  })

  it('navigates with needsNutrition=1 when importing an external hit needs nutrition (P2-R29)', async () => {
    stubSecureContext(false)
    registerEndpoint('/api/nutrition/foods/barcode/3017624010701', () => ({
      found: 'off',
      external: {
        source: 'off', externalId: '3017624010701', name: 'Nutella', brand: 'Ferrero', barcode: '3017624010701',
        per100g: null, servingGrams: null, servingLabel: null, attribution: null
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

    expect(navigateToMock).toHaveBeenCalledWith('/diary/2026-01-01/add?foodId=55&needsNutrition=1')
  })

  it('toasts once when the missing-barcode lookup carries source errors (P2-R31.5)', async () => {
    stubSecureContext(false)
    registerEndpoint('/api/nutrition/foods/barcode/3017624010701', () => {
      throw createError({
        statusCode: 404,
        statusMessage: 'Barcode not found',
        data: { barcode: '3017624010701', errors: [{ source: 'usda', kind: 'rate_limited', message: 'too many requests' }] }
      })
    })

    const wrapper = await mountSuspended(NutritionBarcodeScanner, { props: { date: '2026-01-01' } })
    await flushPromises()

    await wrapper.find('[data-test="scan-manual-input"]').setValue('3017624010701')
    await wrapper.find('[data-test="scan-manual-submit"]').trigger('click')
    await flushPromises()

    expect(toastAddMock).toHaveBeenCalledTimes(1)
    expect(toastAddMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Barcode sources unavailable' }))
    expect(navigateToMock).toHaveBeenCalledWith('/diary/2026-01-01/foods/new?barcode=3017624010701')
  })

  // Drives the race via manual entry (a controllable lookup promise) rather than the camera frame loop, which happy-dom can't exercise.
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
})
