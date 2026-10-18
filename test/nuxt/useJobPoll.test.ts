import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

const { apiFetchMock, warn } = vi.hoisted(() => ({ apiFetchMock: vi.fn(), warn: vi.fn() }))
mockNuxtImport('apiFetch', () => apiFetchMock)
vi.mock('@sentry/nuxt', () => ({ logger: { warn } }))

const { useJobPoll } = await import('../../app/composables/useJobPoll')

async function startPoll(url: string) {
  const onGiveUp = vi.fn()
  let poller!: ReturnType<typeof useJobPoll>
  await mountSuspended(
    defineComponent({
      setup() {
        poller = useJobPoll()
        return () => h('div')
      }
    })
  )
  poller.start(url, { onJob: () => false, onGiveUp })
  return onGiveUp
}

describe('useJobPoll', () => {
  afterEach(() => {
    vi.useRealTimers()
    apiFetchMock.mockReset()
    warn.mockClear()
  })

  it('warns Sentry with the route pattern and counts when it gives up on transient failures', async () => {
    vi.useFakeTimers()
    apiFetchMock.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 503 }))
    const onGiveUp = await startPoll('/api/nutrition/import/mymacros/42')
    await vi.advanceTimersByTimeAsync(2000 + 4000 + 8000 + 16000 + 30000 + 30000)
    expect(onGiveUp).toHaveBeenCalledWith(expect.any(Error), true)
    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith('Job poll gave up', {
      route: '/api/nutrition/import/mymacros/:id',
      failures: 5,
      mayBeRunning: true,
      status: 503
    })
  })

  it('warns once on a definite 404 without retrying', async () => {
    vi.useFakeTimers()
    apiFetchMock.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 404 }))
    const onGiveUp = await startPoll('/api/workouts/import/fitnotes/7')
    await vi.advanceTimersByTimeAsync(2000)
    expect(onGiveUp).toHaveBeenCalledWith(expect.any(Error), false)
    expect(warn).toHaveBeenCalledWith('Job poll gave up', {
      route: '/api/workouts/import/fitnotes/:id',
      failures: 0,
      mayBeRunning: false,
      status: 404
    })
  })
})
