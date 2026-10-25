import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  describe('camera selection', () => {
    const cameras: Record<string, { facingMode: string; minFocusM?: number }> = {
      tele: { facingMode: 'environment', minFocusM: 0.58 },
      ultrawide: { facingMode: 'environment', minFocusM: 0.04 },
      main: { facingMode: 'environment', minFocusM: 0.1 },
      front: { facingMode: 'user' }
    }
    let srcObject: PropertyDescriptor | undefined

    function fakeMediaDevices(defaultId: string, { listsFacing = false } = {}) {
      const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
        const id = requestedId(constraints) ?? defaultId
        const camera = cameras[id]!
        const track = {
          stop: vi.fn(),
          getSettings: () => ({ deviceId: id, facingMode: camera.facingMode }),
          getCapabilities: () => (camera.minFocusM === undefined ? {} : { focusDistance: { min: camera.minFocusM } })
        }
        return { getTracks: () => [track] } as unknown as MediaStream
      })
      const enumerateDevices = async () =>
        Object.entries(cameras).map(
          ([deviceId, { facingMode }]) =>
            ({
              kind: 'videoinput',
              deviceId,
              ...(listsFacing && { getCapabilities: () => ({ facingMode: [facingMode] }) })
            }) as MediaDeviceInfo
        )
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia, enumerateDevices },
        configurable: true
      })
      return getUserMedia
    }

    function requestedId(constraints: MediaStreamConstraints): string | undefined {
      const deviceId = (constraints.video as MediaTrackConstraints).deviceId as ConstrainDOMStringParameters | undefined
      return deviceId?.exact as string | undefined
    }

    const openedIds = (getUserMedia: ReturnType<typeof fakeMediaDevices>) =>
      getUserMedia.mock.calls.map(([constraints]) => requestedId(constraints) ?? 'default')

    beforeEach(() => {
      Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
      localStorage.clear()
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
      srcObject = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject')
      Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { set: () => {}, configurable: true })
    })

    afterEach(() => {
      localStorage.clear()
      if (srcObject) Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', srcObject)
      else Reflect.deleteProperty(HTMLMediaElement.prototype, 'srcObject')
    })

    it('keeps the default camera when it focuses close', async () => {
      const getUserMedia = fakeMediaDevices('main')

      const wrapper = await mountSuspended(NutritionBarcodeCamera)
      await vi.waitFor(() => expect(wrapper.find('[data-test="scan-switch-camera"]').exists()).toBe(true))

      expect(openedIds(getUserMedia)).toEqual(['default'])
      expect(localStorage.getItem('nutrition.barcode.camera')).toBeNull()
      wrapper.unmount()
    })

    it('replaces a default camera that cannot focus close with the main back camera and remembers it', async () => {
      const getUserMedia = fakeMediaDevices('tele')

      const wrapper = await mountSuspended(NutritionBarcodeCamera)
      await vi.waitFor(() => expect(localStorage.getItem('nutrition.barcode.camera')).toBe('main'))

      expect(openedIds(getUserMedia)).toEqual(['default', 'ultrawide', 'main', 'front', 'main'])
      wrapper.unmount()
    })

    it('remembers nothing when unmounted mid-probe', async () => {
      const getUserMedia = fakeMediaDevices('tele')
      const probe = getUserMedia.getMockImplementation()!
      let release!: () => void
      const held = new Promise<void>((resolve) => (release = resolve))
      getUserMedia.mockImplementation(async (constraints) => {
        if (requestedId(constraints) === 'ultrawide') await held
        return probe(constraints)
      })

      const wrapper = await mountSuspended(NutritionBarcodeCamera)
      await vi.waitFor(() => expect(openedIds(getUserMedia)).toEqual(['default', 'ultrawide']))
      wrapper.unmount()
      release()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(openedIds(getUserMedia)).toEqual(['default', 'ultrawide'])
      expect(localStorage.getItem('nutrition.barcode.camera')).toBeNull()
    })

    it('opens the remembered camera without probing', async () => {
      localStorage.setItem('nutrition.barcode.camera', 'ultrawide')
      const getUserMedia = fakeMediaDevices('tele')

      const wrapper = await mountSuspended(NutritionBarcodeCamera)
      await vi.waitFor(() => expect(wrapper.find('[data-test="scan-switch-camera"]').exists()).toBe(true))

      expect(openedIds(getUserMedia)).toEqual(['ultrawide'])
      wrapper.unmount()
    })

    it('switches to the next camera and remembers it', async () => {
      localStorage.setItem('nutrition.barcode.camera', 'ultrawide')
      const getUserMedia = fakeMediaDevices('tele')

      const wrapper = await mountSuspended(NutritionBarcodeCamera)
      await vi.waitFor(() => expect(wrapper.find('[data-test="scan-switch-camera"]').exists()).toBe(true))
      await wrapper.find('[data-test="scan-switch-camera"]').trigger('click')
      await vi.waitFor(() => expect(localStorage.getItem('nutrition.barcode.camera')).toBe('main'))

      expect(openedIds(getUserMedia)).toEqual(['ultrawide', 'main'])
      wrapper.unmount()
    })

    it('passes over a front camera that only reveals itself once opened', async () => {
      localStorage.setItem('nutrition.barcode.camera', 'main')
      const getUserMedia = fakeMediaDevices('tele')

      const wrapper = await mountSuspended(NutritionBarcodeCamera)
      await vi.waitFor(() => expect(wrapper.find('[data-test="scan-switch-camera"]').exists()).toBe(true))
      await wrapper.find('[data-test="scan-switch-camera"]').trigger('click')
      await vi.waitFor(() => expect(localStorage.getItem('nutrition.barcode.camera')).toBe('tele'))

      expect(openedIds(getUserMedia)).toEqual(['main', 'front', 'tele'])
      wrapper.unmount()
    })

    it('leaves a camera the browser lists as front out of the cycle without opening it', async () => {
      localStorage.setItem('nutrition.barcode.camera', 'main')
      const getUserMedia = fakeMediaDevices('tele', { listsFacing: true })

      const wrapper = await mountSuspended(NutritionBarcodeCamera)
      await vi.waitFor(() => expect(wrapper.find('[data-test="scan-switch-camera"]').exists()).toBe(true))
      await wrapper.find('[data-test="scan-switch-camera"]').trigger('click')
      await vi.waitFor(() => expect(localStorage.getItem('nutrition.barcode.camera')).toBe('tele'))

      expect(openedIds(getUserMedia)).toEqual(['main', 'tele'])
      wrapper.unmount()
    })

    it('swaps the switch button for scan again after a hit, and scans again on the same camera', async () => {
      localStorage.setItem('nutrition.barcode.camera', 'main')
      const getUserMedia = fakeMediaDevices('tele')
      Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { get: () => 640, configurable: true })
      Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { get: () => 480, configurable: true })
      const drawImage = vi.fn()
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        drawImage
      } as unknown as CanvasRenderingContext2D)
      const cornerPoints = [
        { x: 10, y: 20 },
        { x: 110, y: 20 },
        { x: 110, y: 60 },
        { x: 10, y: 60 }
      ]
      const detect = vi.fn(async () => [{ format: 'ean_13', rawValue: '3017624010701', cornerPoints }])
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
      await vi.waitFor(() => expect(wrapper.find('[data-test="scan-again"]').exists()).toBe(true))
      expect(wrapper.find('[data-test="scan-switch-camera"]').exists()).toBe(false)
      expect(wrapper.find('[data-test="scan-frame"]').exists()).toBe(false)
      expect(drawImage).toHaveBeenCalledWith(expect.anything(), 64, 96, 512, 288, 0, 0, 512, 288)
      expect(wrapper.find('[data-test="scan-outline"] polygon').attributes('points')).toBe(
        '74,116 174,116 174,156 74,156'
      )

      await wrapper.find('[data-test="scan-again"]').trigger('click')
      expect(wrapper.find('[data-test="scan-outline"]').exists()).toBe(false)
      await vi.waitFor(() => expect(wrapper.emitted('detected')).toHaveLength(2))

      expect(openedIds(getUserMedia)).toEqual(['main', 'main'])
      wrapper.unmount()
    })
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
