import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import NutritionSummaryCard from '../../app/components/nutrition/NutritionSummaryCard.vue'

const targets = [
  { key: 'energy', name: 'Calories', unit: 'kcal', amount: 1900, direction: 'max' as const },
  { key: 'protein', name: 'Protein', unit: 'g', amount: 175, direction: 'min' as const },
  { key: 'fiber', name: 'Fiber', unit: 'g', amount: 27, direction: 'min' as const },
  { key: 'sodium', name: 'Sodium', unit: 'mg', amount: null, direction: null }
]

describe('NutritionSummaryCard', () => {
  it('shows remaining calories in the ring and fiber over its floor as met', async () => {
    const c = await mountSuspended(NutritionSummaryCard, { props: { targets, totals: { energy: 1463, protein: 139, fiber: 39 }, goalName: 'cut1', mode: 'remaining' } })
    expect(c.find('[data-test="energy-value"]').text()).toBe('437')
    expect(c.find('[data-test="fiber-state"]').text()).toBe('met')
    expect(c.find('[data-test="sodium-state"]').text()).toBe('none')
    expect(c.text()).not.toContain('over')
  })

  it('flags calories past the ceiling as over and switches to consumed', async () => {
    const c = await mountSuspended(NutritionSummaryCard, { props: { targets, totals: { energy: 2100, protein: 150, fiber: 20 }, goalName: 'cut1', mode: 'consumed' } })
    expect(c.find('[data-test="energy-state"]').text()).toBe('over')
    expect(c.find('[data-test="energy-value"]').text()).toBe('2100')
    expect(c.find('[data-test="total-protein"]').text()).toContain('150')
  })
})
