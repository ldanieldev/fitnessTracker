import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWakeLock } from '../../app/composables/useWakeLock'

class FakeSentinel extends EventTarget {
  released = false
  readonly type = 'screen'
  onrelease = null

  async release() {
    if (this.released) return
    this.released = true
    this.dispatchEvent(new Event('release'))
  }
}

function stubBrowser({ supported = true, visibilityState = 'visible' } = {}) {
  const sentinels: FakeSentinel[] = []
  const request = vi.fn(async (_type: string) => {
    const sentinel = new FakeSentinel()
    sentinels.push(sentinel)
    return sentinel
  })
  const doc = Object.assign(new EventTarget(), { visibilityState })
  vi.stubGlobal('navigator', supported ? { wakeLock: { request } } : {})
  vi.stubGlobal('document', doc)
  return { request, sentinels, doc }
}

function setVisibility(doc: EventTarget & { visibilityState: string }, state: string) {
  doc.visibilityState = state
  doc.dispatchEvent(new Event('visibilitychange'))
}

describe('useWakeLock', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('acquires a screen wake lock on enable', async () => {
    const { request } = stubBrowser()
    const wakeLock = useWakeLock()

    await wakeLock.enable()

    expect(request).toHaveBeenCalledWith('screen')
    expect(wakeLock.isSupported.value).toBe(true)
    expect(wakeLock.active.value).toBe(true)
  })

  it('stays inactive without throwing when the browser refuses the lock', async () => {
    const { request } = stubBrowser()
    request.mockRejectedValueOnce(new DOMException('low battery', 'NotAllowedError'))
    const wakeLock = useWakeLock()

    await expect(wakeLock.enable()).resolves.toBeUndefined()

    expect(wakeLock.active.value).toBe(false)
  })

  it('retries the lock when enabled again after a refusal', async () => {
    const { request } = stubBrowser()
    request.mockRejectedValueOnce(new DOMException('needs a tap', 'NotAllowedError'))
    const wakeLock = useWakeLock()
    await wakeLock.enable()

    await wakeLock.enable()

    expect(request).toHaveBeenCalledTimes(2)
    expect(wakeLock.active.value).toBe(true)
  })

  it('does nothing when the browser has no wake lock support', async () => {
    stubBrowser({ supported: false })
    const wakeLock = useWakeLock()

    await wakeLock.enable()

    expect(wakeLock.isSupported.value).toBe(false)
    expect(wakeLock.active.value).toBe(false)
  })

  it('reports inactive when the system releases the lock', async () => {
    const { sentinels } = stubBrowser()
    const wakeLock = useWakeLock()
    await wakeLock.enable()

    await sentinels[0]!.release()

    expect(wakeLock.active.value).toBe(false)
  })

  it('re-acquires the lock when the page becomes visible again', async () => {
    const { request, sentinels, doc } = stubBrowser()
    const wakeLock = useWakeLock()
    await wakeLock.enable()

    setVisibility(doc, 'hidden')
    await sentinels[0]!.release()
    setVisibility(doc, 'visible')
    await vi.waitFor(() => expect(wakeLock.active.value).toBe(true))

    expect(request).toHaveBeenCalledTimes(2)
  })

  it('does not stack a second lock when the page turns visible while one is held', async () => {
    const { request, doc } = stubBrowser()
    const wakeLock = useWakeLock()
    await wakeLock.enable()

    setVisibility(doc, 'visible')
    await Promise.resolve()

    expect(request).toHaveBeenCalledOnce()
  })

  it('does not request a lock while the page is hidden', async () => {
    const { request } = stubBrowser({ visibilityState: 'hidden' })
    const wakeLock = useWakeLock()

    await wakeLock.enable()

    expect(request).not.toHaveBeenCalled()
    expect(wakeLock.active.value).toBe(false)
  })

  it('releases the held lock on disable', async () => {
    const { sentinels } = stubBrowser()
    const wakeLock = useWakeLock()
    await wakeLock.enable()

    await wakeLock.disable()

    expect(sentinels[0]!.released).toBe(true)
    expect(wakeLock.active.value).toBe(false)
  })

  it('does not re-acquire on visibility change after disable', async () => {
    const { request, sentinels, doc } = stubBrowser()
    const wakeLock = useWakeLock()
    await wakeLock.enable()
    await wakeLock.disable()

    setVisibility(doc, 'hidden')
    setVisibility(doc, 'visible')
    await Promise.resolve()

    expect(request).toHaveBeenCalledOnce()
    expect(sentinels).toHaveLength(1)
  })

  it('releases a lock that arrives after disable was called', async () => {
    const { request } = stubBrowser()
    let grant!: (sentinel: FakeSentinel) => void
    request.mockImplementationOnce(() => new Promise((resolve) => (grant = resolve)))
    const wakeLock = useWakeLock()

    const pending = wakeLock.enable()
    await wakeLock.disable()
    const late = new FakeSentinel()
    grant(late)
    await pending

    expect(late.released).toBe(true)
    expect(wakeLock.active.value).toBe(false)
  })
})
