import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import DashboardPage from '../../app/pages/index.vue'

const { setups, modules } = await vi.hoisted(async () => {
  const { computed, ref } = await import('vue')
  const shown = { body: ref(true), workouts: ref(false), nutrition: ref(true) }
  return {
    setups: { count: 0 },
    modules: {
      shown,
      api: {
        body: computed(() => shown.body.value),
        workouts: computed(() => shown.workouts.value),
        nutrition: computed(() => shown.nutrition.value)
      }
    }
  }
})
mockNuxtImport('useModules', () => () => modules.api)
mockNuxtImport('useUserSession', () => () => ({
  loggedIn: { value: true },
  user: { value: { id: 1 } },
  fetch: vi.fn(),
  clear: vi.fn()
}))

const empty = defineComponent({ render: () => null })
const strip = defineComponent({
  setup() {
    setups.count++
    return () => h('div')
  }
})

describe('dashboard page', () => {
  it('remounts the Today strip when a module is switched on while mounted', async () => {
    await mountSuspended(DashboardPage, {
      global: {
        stubs: {
          AppNavbar: empty,
          DashboardTodayStrip: strip,
          DashboardBodyweightTrend: empty,
          DashboardStrength: empty,
          DashboardConsistency: empty,
          DashboardNutritionStreak: empty
        }
      }
    })
    expect(setups.count).toBe(1)

    modules.shown.workouts.value = true
    await nextTick()
    expect(setups.count).toBe(2)
  })
})
