import { describe, expect, it } from 'vitest'

describe('macros', () => {
  it('formats energy without decimals and grams with one, dropping .0', async () => {
    const { formatAmount } = await import('../../app/utils/nutrition/macros')
    expect(formatAmount('energy', 206.6)).toBe('207')
    expect(formatAmount('protein', 18)).toBe('18')
    expect(formatAmount('fat', 14.96)).toBe('15')
    expect(formatAmount('carbohydrate', 0.44)).toBe('0.4')
    expect(formatAmount('protein', null)).toBe('—')
  })

  it('builds P/C/F parts in order, energy first when asked, extras only when present', async () => {
    const { macroParts } = await import('../../app/utils/nutrition/macros')
    const parts = macroParts({ energy: 207, protein: 18, fat: 15, fiber: 2.2 }, {
      withEnergy: true,
      extras: [{ key: 'fiber', name: 'Fiber', unit: 'g' }, { key: 'sodium', name: 'Sodium', unit: 'mg' }]
    })
    expect(parts.map((p) => [p.label, p.text])).toEqual([['kcal', '207'], ['P', '18'], ['C', '—'], ['F', '15'], ['Fib', '2.2']])
    expect(parts.map((p) => p.cls)).toEqual(['text-primary', 'text-protein', 'text-carb', 'text-fat', 'text-macro-other'])
  })
})
