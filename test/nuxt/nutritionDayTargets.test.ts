import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { UBadge } from '#components'
import NutritionDayTargets from '../../app/components/nutrition/NutritionDayTargets.vue'

const targets = [
  { key: 'energy', name: 'Calories', unit: 'kcal', amount: 1900, direction: 'max' as const },
  { key: 'protein', name: 'Protein', unit: 'g', amount: 175, direction: 'min' as const },
  { key: 'fiber', name: 'Fiber', unit: 'g', amount: 27, direction: 'min' as const }
]

describe('NutritionDayTargets', () => {
  it('shows fiber over its floor as met, never as over', async () => {
    const c = await mountSuspended(NutritionDayTargets, {
      props: { targets, totals: { energy: 1847, protein: 182, fiber: 39 }, mode: 'remaining', goalName: 'Cut 1' }
    })
    expect(c.find('[data-test="fiber-state"]').text()).toBe('met')
    expect(c.text()).not.toContain('over')
    expect(c.text()).toContain('Cut 1')
  })

  it('shows calories past the ceiling as over', async () => {
    const c = await mountSuspended(NutritionDayTargets, {
      props: { targets, totals: { energy: 2100, protein: 182, fiber: 39 }, mode: 'remaining', goalName: 'Cut 1' }
    })
    expect(c.find('[data-test="energy-state"]').text()).toBe('over')
  })

  it('switches between remaining and consumed', async () => {
    const c = await mountSuspended(NutritionDayTargets, {
      props: { targets, totals: { energy: 1847, protein: 150, fiber: 20 }, mode: 'consumed', goalName: 'Cut 1' }
    })
    expect(c.find('[data-test="energy-value"]').text()).toContain('1847')
    await c.setProps({ mode: 'remaining' })
    expect(c.find('[data-test="energy-value"]').text()).toContain('53')
  })

  it('shows the consumed total regardless of mode', async () => {
    const c = await mountSuspended(NutritionDayTargets, {
      props: { targets, totals: { energy: 1847, protein: 150, fiber: 20 }, mode: 'consumed', goalName: 'Cut 1' }
    })
    expect(c.find('[data-test="total-energy"]').text()).toContain('1847')
    await c.setProps({ mode: 'remaining' })
    expect(c.find('[data-test="total-energy"]').text()).toContain('1847')
  })

  it('shows none and no badge when a macro has no target', async () => {
    const c = await mountSuspended(NutritionDayTargets, {
      props: {
        targets: [{ key: 'sodium', name: 'Sodium', unit: 'mg', amount: null, direction: null }],
        totals: { sodium: 500 },
        mode: 'remaining',
        goalName: null
      }
    })
    expect(c.find('[data-test="sodium-state"]').text()).toBe('none')
    expect(c.findComponent(UBadge).exists()).toBe(false)
  })
})
