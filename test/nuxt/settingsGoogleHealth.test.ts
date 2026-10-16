import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import SettingsGoogleHealth from '../../app/components/settings/SettingsGoogleHealth.vue'
import type { GoogleHealthStatus } from '../../shared/types/googleHealth'

const { toastAdd } = vi.hoisted(() => ({ toastAdd: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: toastAdd }))

const connected: GoogleHealthStatus = {
  available: true,
  connection: {
    email: 'someone@example.com',
    status: 'active',
    lastSyncedAt: null,
    lastError: null,
    syncSteps: false,
    pushWeight: false,
    granted: { sleep: true, metrics: true, activity: true, weightWrite: true }
  }
}

const state = vi.hoisted(() => ({
  status: null as unknown,
  release: null as null | (() => void)
}))

registerEndpoint('/api/integrations/google-health', { method: 'GET', handler: () => state.status })
registerEndpoint('/api/integrations/google-health', {
  method: 'PATCH',
  handler: async () => {
    await new Promise<void>((resolve) => (state.release = resolve))
    return state.status
  }
})

beforeEach(() => {
  state.status = connected
  state.release = null
})

afterEach(() => {
  toastAdd.mockReset()
  clearNuxtData('google-health')
})

describe('SettingsGoogleHealth', () => {
  it('says the server is not set up when Google Health is unavailable', async () => {
    state.status = { available: false, connection: null }
    const wrapper = await mountSuspended(SettingsGoogleHealth)
    expect(wrapper.text()).toContain('Google Health isn\'t set up on this server.')
    expect(wrapper.text()).not.toContain('Connect Google Health')
    wrapper.unmount()
  })

  it('disables a switch while its save is in flight', async () => {
    const wrapper = await mountSuspended(SettingsGoogleHealth)
    const steps = () => wrapper.find('[aria-label="Import steps from Google"]')
    expect(steps().attributes('disabled')).toBeUndefined()
    await steps().trigger('click')
    await vi.waitFor(() => expect(steps().attributes('disabled')).toBeDefined())
    expect(wrapper.find('[aria-label="Send my weigh-ins to Google"]').attributes('disabled')).toBeUndefined()
    await vi.waitFor(() => expect(state.release).not.toBeNull())
    state.release!()
    await vi.waitFor(() => expect(steps().attributes('disabled')).toBeUndefined())
    wrapper.unmount()
  })
})
