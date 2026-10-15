import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { computed } from 'vue'
import DataPage from '../../app/pages/settings/data.vue'

const { shown } = vi.hoisted(() => ({ shown: { workouts: true, nutrition: true } }))
mockNuxtImport('useModules', () => () => ({
  body: computed(() => true),
  workouts: computed(() => shown.workouts),
  nutrition: computed(() => shown.nutrition)
}))

registerEndpoint('/api/tokens', () => [])

afterEach(() => {
  shown.workouts = true
  shown.nutrition = true
})

describe('settings/data page', () => {
  it.each([
    { workouts: true, nutrition: true, fitnotes: true, mymacros: true },
    { workouts: false, nutrition: true, fitnotes: false, mymacros: true },
    { workouts: true, nutrition: false, fitnotes: true, mymacros: false }
  ])('shows import cards for enabled modules (%o)', async ({ workouts, nutrition, fitnotes, mymacros }) => {
    Object.assign(shown, { workouts, nutrition })
    const wrapper = await mountSuspended(DataPage)
    expect(wrapper.find('[data-test="export-download"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="data-tokens"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="import-fitnotes-card"]').exists()).toBe(fitnotes)
    expect(wrapper.find('[data-test="import-mymacros-card"]').exists()).toBe(mymacros)
    wrapper.unmount()
  })

  it('hides the whole Import section when both modules are off', async () => {
    Object.assign(shown, { workouts: false, nutrition: false })
    const wrapper = await mountSuspended(DataPage)
    expect(wrapper.find('[data-test="data-import"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="export-download"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
