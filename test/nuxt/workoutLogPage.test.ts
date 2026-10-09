import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import LogPage from '../../app/pages/workouts/log.vue'
import WorkoutSessionEditor from '../../app/components/workout/WorkoutSessionEditor.vue'
import { useRestTimer } from '../../app/composables/useRestTimer'

mockNuxtImport('useUserSession', () => () => ({
  loggedIn: { value: true },
  user: { value: { id: 1, weekStart: 1 } },
  fetch: vi.fn(),
  clear: vi.fn()
}))

const open = {
  id: 8,
  name: null,
  performedOn: '2026-10-07',
  startedAt: '2026-10-07T15:00:00.000Z',
  endedAt: null,
  notes: null,
  routineDayId: null,
  deload: false,
  entries: []
}
registerEndpoint('/api/workouts/sessions/active', () => open)
registerEndpoint('/api/workouts/sessions/8', {
  method: 'PATCH',
  handler: () => ({ ...open, endedAt: '2026-10-07T16:00:00.000Z' })
})
registerEndpoint('/api/workouts/sessions/8', { method: 'DELETE', handler: () => null })
registerEndpoint('/api/workouts/routines', () => [])

async function settle() {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
}

// The vitest Nuxt app boots without app/plugins, so the page's restTimer plugin is provided here.
beforeAll(() => {
  if (!useNuxtApp().$restTimer) useNuxtApp().provide('restTimer', useRestTimer())
})

afterEach(() => {
  useNuxtApp().$restTimer.skip()
  clearNuxtData()
  document.body.innerHTML = ''
})

describe('workouts/log page', () => {
  it.each(['finished', 'deleted'] as const)('stops a running rest timer when the workout is %s', async (action) => {
    const wrapper = await mountSuspended(LogPage, { route: '/workouts/log' })
    try {
      await settle()
      const timer = useNuxtApp().$restTimer
      timer.start(90)
      expect(timer.isRunning.value).toBe(true)
      if (action === 'finished') await wrapper.find('[data-test="session-finish"]').trigger('click')
      else wrapper.findComponent(WorkoutSessionEditor).vm.$emit('delete')
      await settle()
      expect(timer.isRunning.value).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
})
