import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ExerciseRecordsPanel from '../../app/components/workout/ExerciseRecordsPanel.vue'

const records = {
  repCap: 10,
  assisted: false,
  highlights: [
    { kind: 'max_weight', value: 225, reps: 3, performedOn: '2026-03-08', sessionId: 7 },
    { kind: 'e1rm', value: 245.3, reps: null, performedOn: '2026-03-08', sessionId: 7 },
    { kind: 'set_volume', value: 1480, reps: null, performedOn: '2026-03-01', sessionId: 6 },
    { kind: 'session_volume', value: 2155, reps: null, performedOn: '2026-03-08', sessionId: 7 }
  ],
  repMax: [
    { reps: 1, weight: null, performedOn: null, sessionId: null, estimate: null },
    { reps: 2, weight: null, performedOn: null, sessionId: null, estimate: null },
    { reps: 3, weight: 225, performedOn: '2026-03-08', sessionId: 7, estimate: 245.3 },
    ...Array.from({ length: 12 }, (_, i) => (
      { reps: i + 4, weight: null, performedOn: null, sessionId: null, estimate: null }
    ))
  ]
}

const cardioRecords = {
  repCap: 10,
  assisted: false,
  highlights: [
    { kind: 'max_weight', value: null, reps: null, performedOn: null, sessionId: null },
    { kind: 'e1rm', value: null, reps: null, performedOn: null, sessionId: null },
    { kind: 'set_volume', value: null, reps: null, performedOn: null, sessionId: null },
    { kind: 'session_volume', value: null, reps: null, performedOn: null, sessionId: null }
  ],
  repMax: []
}

const baseProps = { exerciseId: 3, trackingType: 'weight_reps' as const, loadStyle: 'barbell' as const }

describe('ExerciseRecordsPanel', () => {
  it('shows four headline records linking to their sessions', async () => {
    registerEndpoint('/api/workouts/exercises/3/records', () => records)
    const wrapper = await mountSuspended(ExerciseRecordsPanel, { props: baseProps })
    await flushPromises()
    const cards = wrapper.findAll('[data-test="record-card"]')
    expect(cards).toHaveLength(4)
    expect(cards[0]!.text()).toContain('225')
    expect(cards[0]!.find('a').attributes('href')).toBe('/workouts/sessions/7')
  })

  it('renders an em dash for rep counts never logged and no estimate above the cap', async () => {
    registerEndpoint('/api/workouts/exercises/3/records', () => records)
    const wrapper = await mountSuspended(ExerciseRecordsPanel, { props: baseProps })
    await flushPromises()
    const rows = wrapper.findAll('[data-test="rep-max-row"]')
    expect(rows).toHaveLength(15)
    expect(rows[0]!.text()).toContain('—')
    expect(rows[2]!.text()).toContain('225')
    expect(rows[14]!.text()).not.toContain('.')
  })

  it('explains that a cardio exercise has no weight-based records instead of "no records yet"', async () => {
    registerEndpoint('/api/workouts/exercises/3/records', () => cardioRecords)
    const wrapper = await mountSuspended(ExerciseRecordsPanel, {
      props: { exerciseId: 3, trackingType: 'distance_time', loadStyle: null }
    })
    await flushPromises()
    const message = wrapper.find('[data-test="records-no-weight"]')
    expect(message.exists()).toBe(true)
    expect(message.text()).toBe('Records track weight and reps. This exercise logs distance and time.')
    expect(wrapper.text()).not.toContain('No records yet')
  })
})
