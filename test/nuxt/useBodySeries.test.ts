import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import { useBodySeries } from '../../app/composables/useBodySeries'
import { useToday } from '../../app/composables/useToday'
import { BODY_KEYS } from '../../app/composables/useBodyData'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'

describe('useBodySeries', () => {
  it('refetches only when useToday() resolves to a day different from the SSR default', async () => {
    clearNuxtData(BODY_KEYS.seriesRange(1, '3m'))
    let calls = 0
    const typeShape = { id: 1, key: 'bodyweight', name: 'Bodyweight', unit: 'lbs', precision: 1, direction: 'neutral', builtIn: true, hidden: false, sortOrder: null }
    registerEndpoint('/api/body/types/1/series', () => {
      calls += 1
      return { type: typeShape, goal: null, latest: null, granularity: 'day', from: '2026-06-01', to: todayDate(), points: [] }
    })

    useToday().value = null
    const { fetch } = useBodySeries(1, '3m')
    await fetch
    expect(calls).toBe(1)

    useToday().value = todayDate() // same day as the SSR default: the ref should not change, so no refetch
    await flushPromises()
    expect(calls).toBe(1)

    useToday().value = shiftDate(todayDate(), 1) // a different day: exactly one refetch
    await flushPromises()
    expect(calls).toBe(2)
  })
})
