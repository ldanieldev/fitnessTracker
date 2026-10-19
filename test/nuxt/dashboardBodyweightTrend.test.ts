import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, refreshNuxtData } from 'nuxt/app'
import { UCarousel } from '#components'
import DashboardBodyweightTrend from '../../app/components/dashboard/DashboardBodyweightTrend.vue'
import type { BodyweightTrend } from '../../shared/types/dashboard'

let payload: BodyweightTrend | null = null
let fetches = 0
registerEndpoint('/api/dashboard/bodyweight', () => {
  fetches++
  return payload
})
let overview: unknown[] = []
registerEndpoint('/api/body/overview', () => overview)

interface CarouselProbe {
  props: (name: 'dots') => boolean
  vm: { $emit: (event: 'select', index: number) => void }
}
const carouselOf = (wrapper: { findComponent: (c: unknown) => unknown }) =>
  wrapper.findComponent(UCarousel) as unknown as CarouselProbe

const wrappers: { unmount: () => void }[] = []

afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  clearNuxtData('dashboard:bodyweight')
  clearNuxtData('body:overview')
  fetches = 0
})

const base: BodyweightTrend = {
  typeId: 1,
  unit: 'lbs',
  precision: 1,
  direction: 'neutral',
  current: 181.4,
  latest: { value: 181, date: '2026-10-11' },
  previous: { value: 181.4, date: '2026-10-09' },
  change: -1.6,
  week: { from: '2026-10-04', to: '2026-10-10' },
  series: [184, 183, 182.2, 181.4],
  daily: [182, 181.4, 181],
  goal: { targetValue: 175, startValue: 190 }
}

const row = (latest: unknown) => ({
  type: { id: 1, key: 'bodyweight' },
  latest,
  previous: null,
  goal: null,
  sparkline: []
})
const entry = (id: number, value: number) => ({ id, value, measuredOn: '2026-10-11' })

async function mounted() {
  const wrapper = await mountSuspended(DashboardBodyweightTrend)
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

describe('DashboardBodyweightTrend', () => {
  it('shows the weekly average with its week, a toward-goal change, the goal line and distance', async () => {
    payload = base
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="bodyweight-current"]').text()).toBe('181.4')
    expect(wrapper.find('[data-test="bodyweight-week"]').text()).toBe('Oct 4–10')
    const change = wrapper.find('[data-test="bodyweight-change"]')
    expect(change.text()).toBe('↓ 1.6 lbs · 4 wks')
    expect(change.classes()).toContain('text-success')
    expect(wrapper.find('[data-test="sparkline-goal"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="bodyweight-goal"]').text()).toBe('Goal 175.0 · 6.4 lbs to go')
  })

  it('opens on the latest weigh-in with its change since the previous one', async () => {
    payload = base
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="card-aside"]').text()).toBe('Latest')
    expect(wrapper.find('[data-test="bodyweight-latest"]').text()).toBe('181.0')
    const change = wrapper.find('[data-test="bodyweight-daily-change"]')
    expect(change.text()).toBe('↓ 0.4 lbs · since Oct 9')
    expect(change.classes()).toContain('text-success')
    expect(wrapper.text()).toContain('14 days')
  })

  it('labels the weekly average once the carousel selects it', async () => {
    payload = base
    const wrapper = await mounted()
    const carousel = carouselOf(wrapper)
    expect(carousel.props('dots')).toBe(true)
    carousel.vm.$emit('select', 1)
    await nextTick()
    expect(wrapper.find('[data-test="card-aside"]').text()).toBe('Weekly avg')
    expect(wrapper.text()).toContain('12 weeks')
  })

  it('shows only the latest slide, without dots, when the last week has no weigh-ins', async () => {
    payload = {
      ...base,
      goal: null,
      current: null,
      change: null,
      latest: { value: 190, date: '2026-09-01' },
      previous: null,
      series: [],
      daily: []
    }
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="bodyweight-latest"]').text()).toBe('190.0')
    expect(wrapper.text()).toContain('Sep 1')
    expect(wrapper.text()).toContain('Log a few weigh-ins to see a trend')
    expect(wrapper.find('[data-test="bodyweight-slide-average"]').exists()).toBe(false)
    expect(carouselOf(wrapper).props('dots')).toBe(false)
    expect(wrapper.find('[data-test="bodyweight-daily-change"]').exists()).toBe(false)
  })

  it('names both months when the week spans two', async () => {
    payload = { ...base, week: { from: '2026-09-27', to: '2026-10-03' } }
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="bodyweight-week"]').text()).toBe('Sep 27 – Oct 3')
  })

  it('shows an empty state with no readings', async () => {
    payload = { ...base, current: null, latest: null, previous: null, change: null, series: [], daily: [], goal: null }
    const wrapper = await mounted()
    expect(wrapper.text()).toContain('Log a few weigh-ins to see a trend')
    expect(wrapper.find('[data-test="bodyweight-current"]').exists()).toBe(false)
  })

  it('says the goal is reached once passed', async () => {
    payload = { ...base, current: 173 }
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="bodyweight-goal"]').text()).toBe('Goal reached')
  })

  it('refetches when a new weigh-in appears in the body overview', async () => {
    payload = base
    overview = [row({ id: 1 })]
    await mounted()
    const before = fetches
    overview = [row({ id: 2 })]
    await refreshNuxtData('body:overview')
    await flushPromises()
    expect(fetches).toBe(before + 1)
  })

  it('refetches once when the first weigh-in appears after the overview loaded empty', async () => {
    payload = base
    overview = [row(null)]
    await mounted()
    const before = fetches
    overview = [row(entry(1, 180))]
    await refreshNuxtData('body:overview')
    await flushPromises()
    expect(fetches).toBe(before + 1)
  })

  it('refetches once when the same weigh-in is edited', async () => {
    payload = base
    overview = [row(entry(1, 180))]
    await mounted()
    const before = fetches
    overview = [row(entry(1, 179))]
    await refreshNuxtData('body:overview')
    await flushPromises()
    expect(fetches).toBe(before + 1)
  })

  it('fetches the trend once on a cold mount while the overview loads', async () => {
    payload = base
    overview = [row(entry(1, 180))]
    await mounted()
    expect(fetches).toBe(1)
  })
})
