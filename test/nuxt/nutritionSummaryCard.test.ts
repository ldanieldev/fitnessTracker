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
    const c = await mountSuspended(NutritionSummaryCard, {
      props: { targets, totals: { energy: 1463, protein: 139, fiber: 39 }, goalName: 'cut1', mode: 'remaining' }
    })
    expect(c.find('[data-test="energy-value"]').text()).toBe('437')
    expect(c.find('[data-test="fiber-state"]').text()).toBe('met')
    expect(c.find('[data-test="sodium-state"]').text()).toBe('none')
    expect(c.text()).not.toContain('over')
  })

  it('flags calories past the ceiling as over and switches to consumed', async () => {
    const c = await mountSuspended(NutritionSummaryCard, {
      props: { targets, totals: { energy: 2100, protein: 150, fiber: 20 }, goalName: 'cut1', mode: 'consumed' }
    })
    expect(c.find('[data-test="energy-state"]').text()).toBe('over')
    expect(c.find('[data-test="energy-value"]').text()).toBe('2100')
    expect(c.find('[data-test="total-protein"]').text()).toContain('150')
  })

  it('shows the overage as a bare number labelled "kcal over" in remaining mode', async () => {
    const c = await mountSuspended(NutritionSummaryCard, {
      props: { targets, totals: { energy: 1909, protein: 150, fiber: 20 }, goalName: 'cut1', mode: 'remaining' }
    })
    expect(c.find('[data-test="ring-value"]').text()).toBe('9')
    expect(c.find('svg[aria-label]').attributes('aria-label')).toBe('9 kcal over')
  })

  it('shows how far protein is past an at-least goal in remaining mode', async () => {
    const c = await mountSuspended(NutritionSummaryCard, {
      props: { targets, totals: { energy: 1500, protein: 190, fiber: 20 }, goalName: 'cut1', mode: 'remaining' }
    })
    expect(c.find('[data-test="bar-protein"]').text()).toContain('15 g over')
  })

  it('colours only the word "over" red in a bar figure, never "left"', async () => {
    const c = await mountSuspended(NutritionSummaryCard, {
      props: { targets, totals: { energy: 1500, protein: 190, fiber: 20 }, goalName: 'cut1', mode: 'remaining' }
    })
    expect(c.find('[data-test="bar-protein"] .text-error').text()).toBe('over')
    const under = await mountSuspended(NutritionSummaryCard, {
      props: { targets, totals: { energy: 1500, protein: 100, fiber: 20 }, goalName: 'cut1', mode: 'remaining' }
    })
    expect(under.find('[data-test="bar-protein"]').text()).toContain('75 g left')
    expect(under.find('[data-test="bar-protein"] .text-error').exists()).toBe(false)
  })

  it('colours the ring red only when calories are over', async () => {
    const under = await mountSuspended(NutritionSummaryCard, {
      props: { targets, totals: { energy: 1500 }, goalName: 'cut1', mode: 'remaining' }
    })
    expect(under.find('svg .stroke-error, svg .stroke-primary').exists()).toBe(false)
    const over = await mountSuspended(NutritionSummaryCard, {
      props: { targets, totals: { energy: 2100 }, goalName: 'cut1', mode: 'remaining' }
    })
    expect(over.find('svg .stroke-error').exists()).toBe(true)
  })

  describe('green ring when calories and every macro land within 5%', () => {
    const breakTargets = [
      { key: 'energy', name: 'Calories', unit: 'kcal', amount: 2300, direction: 'max' as const },
      { key: 'protein', name: 'Protein', unit: 'g', amount: 175, direction: 'min' as const },
      { key: 'carbohydrate', name: 'Carbs', unit: 'g', amount: 265, direction: 'max' as const },
      { key: 'fat', name: 'Fat', unit: 'g', amount: 60, direction: 'max' as const },
      { key: 'fiber', name: 'Fiber', unit: 'g', amount: 30, direction: 'min' as const }
    ]
    const ring = async (totals: Record<string, number>) => {
      const c = await mountSuspended(NutritionSummaryCard, {
        props: { targets: breakTargets, totals, goalName: 'Break', mode: 'remaining' }
      })
      return c.find('svg circle[stroke-linecap]').classes()
    }

    it('is green on a day inside every band, ignoring fiber', async () => {
      expect(await ring({ energy: 2298, protein: 177, carbohydrate: 261, fat: 62, fiber: 0 })).toContain(
        'stroke-success'
      )
    })

    it('stays grey when one macro is outside its band', async () => {
      expect(await ring({ energy: 2267, protein: 178, carbohydrate: 264, fat: 56 })).not.toContain('stroke-success')
    })

    it('stays grey when calories are under 95% of the limit', async () => {
      expect(await ring({ energy: 2100, protein: 180, carbohydrate: 265, fat: 60 })).not.toContain('stroke-success')
    })

    it('is red, not green, once calories are over', async () => {
      expect(await ring({ energy: 2310, protein: 176, carbohydrate: 265, fat: 60 })).toContain('stroke-error')
    })
  })

  it('labels the ring "kcal eaten" in remaining mode when there is no energy target', async () => {
    const noEnergyTarget = targets.map((t) => (t.key === 'energy' ? { ...t, amount: null, direction: null } : t))
    const c = await mountSuspended(NutritionSummaryCard, {
      props: {
        targets: noEnergyTarget,
        totals: { energy: 1463, protein: 139, fiber: 39 },
        goalName: 'cut1',
        mode: 'remaining'
      }
    })
    expect(c.find('svg[aria-label]').attributes('aria-label')).toContain('kcal eaten')
  })
})
