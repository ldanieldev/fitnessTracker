import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import DashboardStrength from '../../app/components/dashboard/DashboardStrength.vue'
import type { Strength } from '../../shared/types/dashboard'

let payload: Strength | null = null
registerEndpoint('/api/dashboard/strength', () => payload)
afterEach(() => clearNuxtData('dashboard:strength'))

async function mounted() {
  const wrapper = await mountSuspended(DashboardStrength)
  await flushPromises()
  return wrapper
}

const lift = (over: Partial<Strength['lifts'][number]>): Strength['lifts'][number] => ({
  exerciseId: 1,
  name: 'Barbell Bench Press',
  metric: 'e1rm',
  unit: 'lb',
  value: 225,
  change: 10,
  lowerIsBetter: false,
  goal: null,
  series: [210, 215, 225],
  ...over
})

describe('DashboardStrength', () => {
  it('lists lifts with value, change, goal progress and most-trained label', async () => {
    payload = {
      lifts: [
        lift({ goal: { targetValue: 245, targetReps: null, progress: 0.5 } }),
        lift({ exerciseId: 2, name: 'Romanian Deadlift', value: 240, change: -5 })
      ]
    }
    const wrapper = await mounted()
    const rows = wrapper.findAll('[data-test="strength-lift"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Barbell Bench Press')
    expect(rows[0]!.find('[data-test="lift-value"]').text()).toBe('225.0')
    expect(rows[0]!.find('[data-test="lift-change"]').text()).toBe('+10.0')
    expect(rows[0]!.find('[data-test="lift-change"]').classes()).toContain('text-success')
    expect(rows[0]!.text()).toContain('goal 245.0')
    expect(rows[0]!.find('[data-test="lift-goal-bar"]').attributes('style')).toContain('width: 50%')
    expect(rows[1]!.find('[data-test="lift-change"]').classes()).toContain('text-error')
    expect(rows[1]!.text()).toContain('most trained')
  })

  it('shows the target reps on a weight-at-reps goal', async () => {
    payload = {
      lifts: [
        lift({ metric: 'weight_at_reps', goal: { targetValue: 225, targetReps: 5, progress: 0.4 } })
      ]
    }
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="strength-lift"]').text()).toContain('goal 225.0 × 5')
  })

  it('shows the server-provided unit for cardio goals', async () => {
    payload = { lifts: [lift({ metric: 'pace', unit: 'm/s', value: 3.25, change: 0.1 })] }
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="strength-lift"]').text()).toContain('m/s')
    expect(wrapper.find('[data-test="strength-lift"]').text()).not.toContain('lb')
  })

  it('flips the colour when lower is better and shows an empty state', async () => {
    payload = { lifts: [lift({ lowerIsBetter: true, change: -5 })] }
    const wrapper = await mounted()
    expect(wrapper.find('[data-test="lift-change"]').classes()).toContain('text-success')
    clearNuxtData('dashboard:strength')
    payload = { lifts: [] }
    const empty = await mounted()
    expect(empty.text()).toContain('Log a few workouts to see strength trends')
  })

  it('names a fallback metric next to the value and leaves e1RM unlabelled', async () => {
    payload = {
      lifts: [
        lift({}),
        lift({ exerciseId: 2, metric: 'max_weight', value: 200 }),
        lift({ exerciseId: 3, metric: 'max_weight', lowerIsBetter: true, value: 40 })
      ]
    }
    const rows = (await mounted()).findAll('[data-test="strength-lift"]')
    expect(rows[0]!.find('[data-test="lift-metric"]').exists()).toBe(false)
    expect(rows[1]!.find('[data-test="lift-metric"]').text()).toBe('Max weight')
    expect(rows[2]!.find('[data-test="lift-metric"]').text()).toBe('Lowest assist')
  })

  it('tones the sparkline by the series direction when there is no change', async () => {
    const stroke = (row: { find: (s: string) => { attributes: (a: string) => string | undefined } }) =>
      row.find('[data-test="dashboard-sparkline"] path').attributes('stroke')
    payload = {
      lifts: [
        lift({ change: null, series: [200, 210] }),
        lift({ exerciseId: 2, change: null, series: [210, 200] }),
        lift({ exerciseId: 3, change: null, lowerIsBetter: true, series: [50, 40] }),
        lift({ exerciseId: 4, change: null, lowerIsBetter: true, series: [40, 50] }),
        lift({ exerciseId: 5, change: null, series: [200, 200] })
      ]
    }
    const rows = (await mounted()).findAll('[data-test="strength-lift"]')
    expect(rows.map((row) => stroke(row))).toEqual([
      'var(--ui-success)',
      'var(--ui-error)',
      'var(--ui-success)',
      'var(--ui-error)',
      'var(--ui-text-dimmed)'
    ])
  })

  it('exposes goal progress as a progressbar', async () => {
    payload = { lifts: [lift({ goal: { targetValue: 245, targetReps: null, progress: 0.426 } })] }
    const bar = (await mounted()).get('[role="progressbar"]')
    expect(bar.attributes()).toMatchObject({ 'aria-valuenow': '43', 'aria-valuemin': '0', 'aria-valuemax': '100' })
    expect(bar.attributes('aria-label')).toBe('Barbell Bench Press goal progress')
  })
})
