import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import SettingsWorkout from '../../app/pages/settings/workout.vue'

const { session } = vi.hoisted(() => ({ session: { user: null as Record<string, unknown> | null } }))

mockNuxtImport('useUserSession', () => () => ({ user: { value: session.user }, fetch: vi.fn() }))
mockNuxtImport('useToast', () => () => ({ add: vi.fn() }))

describe('settings/workout plates', () => {
  it('renders the picker when the session carries plate sizes', async () => {
    session.user = { id: 1, name: 'A', email: 'a@b.c', weekStart: 1, defaultRestSeconds: 90, plateSizes: [45, 25] }
    const wrapper = await mountSuspended(SettingsWorkout)
    expect(wrapper.find('[data-test="plate-chip-45"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Sign in again to edit your plates.')
  })

  it('hides the picker and asks for a fresh sign-in when the session predates plate sizes', async () => {
    session.user = { id: 1, name: 'A', email: 'a@b.c', weekStart: 1, defaultRestSeconds: 90 }
    const wrapper = await mountSuspended(SettingsWorkout)
    expect(wrapper.find('[data-test="plate-chip-45"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Sign in again to edit your plates.')
  })
})
