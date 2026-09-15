import { describe, expect, it } from 'vitest'

const entries = [
  { id: 1, containerId: 10, quantity: 100, unitLabel: 'g' },
  { id: 2, containerId: 10, quantity: 2, unitLabel: 'slice' },
  { id: 3, containerId: 11, quantity: 1, unitLabel: 'serving' }
]

describe('applyOverrides', () => {
  it('passes entries through untouched with no overrides', async () => {
    const { applyOverrides } = await import('../../shared/utils/nutritionCopy')
    expect(applyOverrides(entries, [], null)).toHaveLength(3)
  })

  it('drops excluded entries', async () => {
    const { applyOverrides } = await import('../../shared/utils/nutritionCopy')
    const plan = applyOverrides(entries, [{ sourceEntryId: 2, exclude: true }], null)
    expect(plan.map((p) => p.sourceEntryId)).toEqual([1, 3])
  })

  it('applies per-item quantity and unit adjustments', async () => {
    const { applyOverrides } = await import('../../shared/utils/nutritionCopy')
    const plan = applyOverrides(entries, [{ sourceEntryId: 1, quantity: 250 }], null)
    expect(plan.find((p) => p.sourceEntryId === 1)!.quantity).toBe(250)
  })

  it('preserves each entry container when the target container is null', async () => {
    const { applyOverrides } = await import('../../shared/utils/nutritionCopy')
    const plan = applyOverrides(entries, [], null)
    expect(plan.map((p) => p.containerId)).toEqual([10, 10, 11])
  })

  it('redirects every entry when a target container is given', async () => {
    const { applyOverrides } = await import('../../shared/utils/nutritionCopy')
    const plan = applyOverrides(entries, [], 99)
    expect(plan.every((p) => p.containerId === 99)).toBe(true)
  })

  it('throws when every entry is excluded', async () => {
    const { applyOverrides } = await import('../../shared/utils/nutritionCopy')
    const all = entries.map((e) => ({ sourceEntryId: e.id, exclude: true }))
    expect(() => applyOverrides(entries, all, null)).toThrow(/nothing to copy/i)
  })

  it('rejects a non-positive override quantity', async () => {
    const { applyOverrides } = await import('../../shared/utils/nutritionCopy')
    expect(() => applyOverrides(entries, [{ sourceEntryId: 1, quantity: 0 }], null)).toThrow(/positive/i)
  })
})
