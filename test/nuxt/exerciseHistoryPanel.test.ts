import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ExerciseHistoryPanel from '../../app/components/workout/ExerciseHistoryPanel.vue'

const sessions = [
  {
    sessionId: 7,
    performedOn: '2026-03-08',
    name: 'Push day',
    trackingType: 'weight_reps',
    loadStyle: 'barbell',
    sets: [
      {
        id: 1,
        sortOrder: 0,
        weight: 185,
        reps: 8,
        distanceMeters: null,
        durationSeconds: null,
        done: true,
        comment: null,
        records: []
      },
      {
        id: 2,
        sortOrder: 1,
        weight: 205,
        reps: 5,
        distanceMeters: null,
        durationSeconds: null,
        done: true,
        comment: 'grinder',
        records: [{ kind: 'weight_reps', previous: 185 }]
      }
    ],
    totals: { sets: 2, volume: 2505, topWeight: 205, topWeightReps: 5 }
  }
]

describe('ExerciseHistoryPanel', () => {
  it('lists each session with its sets, records and totals', async () => {
    registerEndpoint('/api/workouts/exercises/3/history', () => sessions)
    const wrapper = await mountSuspended(ExerciseHistoryPanel, { props: { exerciseId: 3 } })
    await flushPromises()
    expect(wrapper.text()).toContain('Push day')
    expect(wrapper.text()).toContain('185 lb × 8')
    expect(wrapper.findAll('[data-test="history-set"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-test="history-record"]')).toHaveLength(1)
    expect(wrapper.find('[data-test="history-totals"]').text()).toContain('2505')
  })

  it('says so when the exercise has never been logged', async () => {
    registerEndpoint('/api/workouts/exercises/4/history', () => [])
    const wrapper = await mountSuspended(ExerciseHistoryPanel, { props: { exerciseId: 4 } })
    await flushPromises()
    expect(wrapper.text()).toContain('No sessions logged yet')
  })
})
