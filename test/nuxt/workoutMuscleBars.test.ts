import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutMuscleBars from '../../app/components/workout/WorkoutMuscleBars.vue'

const muscles = [
  { key: 'chest', name: 'Chest', volume: 12000, sets: 12 },
  { key: 'triceps', name: 'Triceps', volume: 3000, sets: 6 }
]

describe('WorkoutMuscleBars', () => {
  it('scales every bar against the biggest muscle', async () => {
    const wrapper = await mountSuspended(WorkoutMuscleBars, { props: { muscles } })
    const bars = wrapper.findAll('[data-test="muscle-bar-fill"]')
    expect(bars[0]!.attributes('style')).toContain('100%')
    expect(bars[1]!.attributes('style')).toContain('25%')
    expect(wrapper.text()).toContain('12 sets')
  })

  it('says so when nothing was trained in the range', async () => {
    const wrapper = await mountSuspended(WorkoutMuscleBars, { props: { muscles: [] } })
    expect(wrapper.text()).toContain('Nothing logged in this range')
  })
})
