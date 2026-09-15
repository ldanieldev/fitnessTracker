import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

const { clearMock, navigateToMock, routeState, fetchMock } = vi.hoisted(() => ({
  clearMock: vi.fn(),
  navigateToMock: vi.fn(),
  routeState: { path: '/diary/2026-01-01' },
  fetchMock: vi.fn()
}))

mockNuxtImport('useUserSession', () => () => ({ clear: clearMock }))
mockNuxtImport('navigateTo', () => navigateToMock)
mockNuxtImport('useRoute', () => () => routeState)
mockNuxtImport('$fetch', () => fetchMock)

describe('handleUnauthorized', () => {
  afterEach(() => {
    clearMock.mockClear()
    navigateToMock.mockClear()
    fetchMock.mockClear()
    routeState.path = '/diary/2026-01-01'
  })

  it('clears the session, redirects to login, and reports that it acted', async () => {
    const { handleUnauthorized } = await import('../../app/composables/useSessionGuard')
    await expect(handleUnauthorized()).resolves.toBe(true)
    expect(clearMock).toHaveBeenCalledTimes(1)
    expect(navigateToMock).toHaveBeenCalledWith('/auth/login')
  })

  it('does nothing and reports false when already on an auth page (no redirect loop)', async () => {
    routeState.path = '/auth/login'
    const { handleUnauthorized } = await import('../../app/composables/useSessionGuard')
    await expect(handleUnauthorized()).resolves.toBe(false)
    expect(clearMock).not.toHaveBeenCalled()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('collapses a burst of concurrent 401s into a single redirect', async () => {
    const { handleUnauthorized } = await import('../../app/composables/useSessionGuard')
    const results = await Promise.all([handleUnauthorized(), handleUnauthorized(), handleUnauthorized()])
    expect(results).toEqual([true, true, true])
    expect(clearMock).toHaveBeenCalledTimes(1)
    expect(navigateToMock).toHaveBeenCalledTimes(1)
  })
})

describe('apiFetch', () => {
  afterEach(() => {
    clearMock.mockClear()
    navigateToMock.mockClear()
    fetchMock.mockClear()
    routeState.path = '/diary/2026-01-01'
  })

  it('resolves with the $fetch result on success', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    const { apiFetch } = await import('../../app/composables/useSessionGuard')
    await expect(apiFetch('/api/whatever')).resolves.toEqual({ ok: true })
  })

  it('rethrows a non-401 error untouched', async () => {
    const error = Object.assign(new Error('nope'), { statusCode: 400 })
    fetchMock.mockRejectedValueOnce(error)
    const { apiFetch } = await import('../../app/composables/useSessionGuard')
    await expect(apiFetch('/api/whatever')).rejects.toBe(error)
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('on a 401 away from an auth page, redirects and never settles', async () => {
    const error = Object.assign(new Error('unauthorized'), { statusCode: 401 })
    fetchMock.mockRejectedValueOnce(error)
    const { apiFetch } = await import('../../app/composables/useSessionGuard')

    const sentinel = Symbol('pending')
    const settled = await Promise.race([apiFetch('/api/whatever'), Promise.resolve(sentinel)])
    // Give the promise's own microtasks a chance to run before asserting it's still pending.
    await Promise.resolve()
    await Promise.resolve()

    expect(settled).toBe(sentinel)
    expect(navigateToMock).toHaveBeenCalledWith('/auth/login')
  })

  it('on a 401 on an auth page (bad credentials), rethrows so the caller can show its own error', async () => {
    routeState.path = '/auth/login'
    const error = Object.assign(new Error('bad credentials'), { statusCode: 401 })
    fetchMock.mockRejectedValueOnce(error)
    const { apiFetch } = await import('../../app/composables/useSessionGuard')
    await expect(apiFetch('/api/auth/login')).rejects.toBe(error)
    expect(navigateToMock).not.toHaveBeenCalled()
  })
})
