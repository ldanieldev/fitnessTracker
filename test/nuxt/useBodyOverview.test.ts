import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import { useBodyOverview } from '../../app/composables/useBodyOverview'
import { BODY_KEYS, invalidateBody } from '../../app/composables/useBodyData'

describe('useBodyOverview', () => {
  it('shares one fetch between callers and refetches on invalidateBody', async () => {
    let calls = 0
    registerEndpoint('/api/body/overview', () => {
      calls += 1
      return [{ type: { id: 1, key: 'bodyweight', name: 'Bodyweight', unit: 'lbs', precision: 1, direction: 'neutral', builtIn: true, hidden: false, sortOrder: null }, latest: null, previous: null, goal: null, sparkline: [] }]
    })
    const a = useBodyOverview()
    const b = useBodyOverview()
    await Promise.all([a.fetch, b.fetch])
    expect(calls).toBe(1)
    expect(a.metrics.value[0]?.type.name).toBe('Bodyweight')
    expect(b.metrics.value).toBe(a.metrics.value)
    await invalidateBody(BODY_KEYS.overview)
    expect(calls).toBe(2)
  })

  it('forces a fresh fetch when invalidateBody fires mid-flight, and discards a stale late response', async () => {
    clearNuxtData(BODY_KEYS.overview) // the prior test leaves this key's asyncData status 'success', which would skip the initial fetch below
    let calls = 0
    let resolveFirst: (value: unknown) => void = () => {}
    const first = new Promise((resolve) => {
      resolveFirst = resolve
    })
    const typeShape = { id: 1, key: 'bodyweight', unit: 'lbs', precision: 1, direction: 'neutral', builtIn: true, hidden: false, sortOrder: null }
    registerEndpoint('/api/body/overview', () => {
      calls += 1
      if (calls === 1) return first
      return [{ type: { ...typeShape, name: 'Second' }, latest: null, previous: null, goal: null, sparkline: [] }]
    })

    const { metrics } = useBodyOverview() // fetch #1 starts and hangs on `first`
    await invalidateBody(BODY_KEYS.overview) // fires while #1 is still in flight
    expect(calls).toBe(2)
    expect(metrics.value[0]?.type.name).toBe('Second')

    resolveFirst([{ type: { ...typeShape, name: 'Stale' }, latest: null, previous: null, goal: null, sparkline: [] }])
    await flushPromises()
    expect(metrics.value[0]?.type.name).toBe('Second')
  })
})
