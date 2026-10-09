import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WorkoutPlateBar from '../../app/components/workout/WorkoutPlateBar.vue'

describe('WorkoutPlateBar', () => {
  it('draws each side\'s plates on both sleeves and names them', async () => {
    const wrapper = await mountSuspended(WorkoutPlateBar, { props: { plates: [45, 25, 5], heaviest: 45 } })
    expect(wrapper.findAll('[data-test="plate"]')).toHaveLength(6)
    expect(wrapper.find('svg').attributes('aria-label')).toBe('Each side: 45 · 25 · 5')
  })

  it('scales plate height with size', async () => {
    const wrapper = await mountSuspended(WorkoutPlateBar, { props: { plates: [45, 5], heaviest: 45 } })
    const heights = wrapper.findAll('[data-test="plate"]').map((plate) => Number(plate.attributes('height')))
    expect(heights[0]).toBeGreaterThan(heights[2]!)
  })
})
