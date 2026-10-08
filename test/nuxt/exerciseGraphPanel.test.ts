import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { USelect } from '#components'
import ExerciseGraphPanel from '../../app/components/workout/ExerciseGraphPanel.vue'
import WorkoutMetricChart from '../../app/components/workout/WorkoutMetricChart.vue'

interface SelectProbe {
  props: (key: string) => unknown
}

const exercise = {
  id: 3, name: 'Bench Press', trackingType: 'weight_reps', loadStyle: 'barbell', defaultGraph: null
}

const series = {
  metric: 'e1rm', reps: null, unit: 'lb', precision: 1, from: '2026-03-01', to: '2026-03-31',
  points: [{ date: '2026-03-01', value: 220 }, { date: '2026-03-08', value: 235 }], goal: null
}

describe('ExerciseGraphPanel', () => {
  it('offers only the metrics the exercise supports and plots the series', async () => {
    registerEndpoint('/api/workouts/exercises/3/series', () => series)
    const wrapper = await mountSuspended(ExerciseGraphPanel, { props: { exercise: exercise as never } })
    await flushPromises()
    expect(wrapper.find('[data-test="metric-chart"]').exists()).toBe(true)
    // USelect renders a combobox trigger, not native <option> elements, so read its items prop instead.
    const select = wrapper.findComponent(USelect) as unknown as SelectProbe
    const options = (select.props('items') as { label: string }[]).map((o) => o.label)
    expect(options).toEqual(['Estimated 1RM', 'Max weight', 'Volume', 'Total reps', 'Weight at reps'])
  })

  it('shows the rep stepper only for weight at reps', async () => {
    registerEndpoint('/api/workouts/exercises/3/series', () => ({ ...series, metric: 'weight_at_reps', reps: 5 }))
    const wrapper = await mountSuspended(ExerciseGraphPanel, {
      props: { exercise: { ...exercise, defaultGraph: 'weight_at_reps' } as never }
    })
    await flushPromises()
    expect(wrapper.find('[data-test="graph-reps"]').exists()).toBe(true)
  })

  it('plots distance in miles and states the goal in miles', async () => {
    registerEndpoint('/api/workouts/exercises/3/series', () => ({
      metric: 'distance', reps: null, unit: 'm', precision: 0, from: '2026-03-01', to: '2026-03-31',
      points: [{ date: '2026-03-01', value: 5000 }, { date: '2026-03-08', value: 8046.72 }],
      goal: { exerciseId: 3, metric: 'distance', targetValue: 16093.44, targetReps: null, targetDate: null, achievedAt: null }
    }))
    const run = { ...exercise, name: 'Run', trackingType: 'distance_time', loadStyle: null, defaultGraph: 'distance' }
    const wrapper = await mountSuspended(ExerciseGraphPanel, { props: { exercise: run as never } })
    await flushPromises()
    expect(wrapper.find('svg').attributes('aria-label')).toContain('latest 5 mi on')
    expect(wrapper.find('[data-test="graph-goal-summary"]').text()).toContain('Goal 10 mi')
  })
  it('drops a zero pace from an older rollup instead of plotting an infinite min/mi', async () => {
    registerEndpoint('/api/workouts/exercises/3/series', () => ({
      metric: 'pace', reps: null, unit: 'm/s', precision: 2, from: '2026-03-01', to: '2026-03-31',
      points: [{ date: '2026-03-01', value: 0 }, { date: '2026-03-08', value: 2.68224 }],
      goal: null
    }))
    const run = { ...exercise, name: 'Run', trackingType: 'distance_time', loadStyle: null, defaultGraph: 'pace' }
    const wrapper = await mountSuspended(ExerciseGraphPanel, { props: { exercise: run as never } })
    await flushPromises()
    const points = wrapper.findComponent(WorkoutMetricChart).props('points') as { date: string, value: number }[]
    expect(points.map((point) => point.date)).toEqual(['2026-03-08'])
    expect(points[0]!.value).toBeCloseTo(10, 5)
  })
})
