import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import LogPage from '../../app/pages/workouts/log.vue'
import { useRestTimer } from '../../app/composables/useRestTimer'

mockNuxtImport('useUserSession', () => () => ({
  loggedIn: { value: true },
  user: { value: { id: 1, weekStart: 1 } },
  fetch: vi.fn(),
  clear: vi.fn()
}))

registerEndpoint('/api/workouts/sessions/active', () => null)
registerEndpoint('/api/workouts/routines', () => [])

async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
}

beforeAll(() => {
  if (!useNuxtApp().$restTimer) useNuxtApp().provide('restTimer', useRestTimer())
})

afterEach(() => {
  clearNuxtData()
  document.body.innerHTML = ''
})

describe('workouts/log page without a session', () => {
  it('offers workout tools from the menu', async () => {
    const wrapper = await mountSuspended(LogPage, { route: '/workouts/log' })
    try {
      await settle()
      await wrapper.find('[data-test="log-menu"]').trigger('click')
      await nextTick()
      expect(document.body.querySelector('[data-test="tools-open"]')).not.toBeNull()
    } finally {
      wrapper.unmount()
    }
  })

  it('toggles keep-screen-awake from the menu', async () => {
    const sentinel = {
      release: vi.fn(async () => {}),
      addEventListener: vi.fn()
    }
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: vi.fn(async () => sentinel) }
    })
    const wrapper = await mountSuspended(LogPage, { route: '/workouts/log' })
    try {
      await settle()
      const open = async () => {
        await wrapper.find('[data-test="log-menu"]').trigger('click')
        await nextTick()
      }
      await open()
      const toggle = () =>
        document.body
          .querySelector<HTMLElement>('[data-test="wake-lock-toggle"]')!
          .closest<HTMLElement>('[role="menuitemcheckbox"]')!
      expect(toggle().getAttribute('aria-checked')).toBe('true')
      toggle().click()
      await settle()
      expect(toggle().getAttribute('aria-checked')).toBe('false')
    } finally {
      wrapper.unmount()
      Reflect.deleteProperty(navigator, 'wakeLock')
    }
  })
})
