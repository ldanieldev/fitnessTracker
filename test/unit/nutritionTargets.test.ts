import { describe, expect, it } from 'vitest'

describe('evaluateTarget — max direction (calories, fat)', () => {
  it('is met while under and reports what is left', async () => {
    const { evaluateTarget } = await import('../../shared/utils/nutritionTargets')
    const r = evaluateTarget({ consumed: 1847, target: 1900, direction: 'max' })
    expect(r.remaining).toBe(53)
    expect(r.state).toBe('met')
  })

  it('is over once remaining goes negative', async () => {
    const { evaluateTarget } = await import('../../shared/utils/nutritionTargets')
    const r = evaluateTarget({ consumed: 1985, target: 1900, direction: 'max' })
    expect(r.remaining).toBe(-85)
    expect(r.state).toBe('over')
  })
})

describe('evaluateTarget — min direction (protein, fiber)', () => {
  it('is under until the floor is reached', async () => {
    const { evaluateTarget } = await import('../../shared/utils/nutritionTargets')
    const r = evaluateTarget({ consumed: 150, target: 175, direction: 'min' })
    expect(r.remaining).toBe(25)
    expect(r.state).toBe('under')
  })

  it('NEVER reads as over — fiber at 39 g against a 27 g floor is the plan working', async () => {
    const { evaluateTarget } = await import('../../shared/utils/nutritionTargets')
    const r = evaluateTarget({ consumed: 39, target: 27, direction: 'min' })
    expect(r.state).toBe('met')
    expect(r.remaining).toBe(0)
  })

  it('clamps remaining at zero rather than going negative', async () => {
    const { evaluateTarget } = await import('../../shared/utils/nutritionTargets')
    expect(evaluateTarget({ consumed: 182, target: 175, direction: 'min' }).remaining).toBe(0)
  })
})

describe('evaluateTarget — target direction (carbs)', () => {
  it('is met inside the default 5% band', async () => {
    const { evaluateTarget } = await import('../../shared/utils/nutritionTargets')
    expect(evaluateTarget({ consumed: 171, target: 165, direction: 'target' }).state).toBe('met')
  })

  it('drifts in both directions outside the band', async () => {
    const { evaluateTarget } = await import('../../shared/utils/nutritionTargets')
    expect(evaluateTarget({ consumed: 200, target: 165, direction: 'target' }).state).toBe('over')
    expect(evaluateTarget({ consumed: 120, target: 165, direction: 'target' }).state).toBe('under')
  })
})

describe('evaluateTarget — progress and guards', () => {
  it('reports progress as a 0..1 fraction clamped at 1', async () => {
    const { evaluateTarget } = await import('../../shared/utils/nutritionTargets')
    expect(evaluateTarget({ consumed: 950, target: 1900, direction: 'max' }).progress).toBeCloseTo(0.5, 10)
    expect(evaluateTarget({ consumed: 2500, target: 1900, direction: 'max' }).progress).toBe(1)
  })

  it('treats a zero target as having no progress rather than dividing by zero', async () => {
    const { evaluateTarget } = await import('../../shared/utils/nutritionTargets')
    expect(evaluateTarget({ consumed: 10, target: 0, direction: 'max' }).progress).toBe(1)
    expect(evaluateTarget({ consumed: 0, target: 0, direction: 'max' }).progress).toBe(0)
  })
})

describe('ensureEnergyTarget', () => {
  const make = (amount: number) => ({ key: 'energy', amount, direction: 'max' as const })

  it('leaves an existing energy row untouched', async () => {
    const { ensureEnergyTarget } = await import('../../shared/utils/nutritionTargets')
    const targets = [{ key: 'energy', amount: 2000, direction: 'max' as const }]
    expect(ensureEnergyTarget(targets, make)).toBe(targets)
  })

  it('prefers calories over deriving from macros', async () => {
    const { ensureEnergyTarget } = await import('../../shared/utils/nutritionTargets')
    const targets = [
      { key: 'protein', amount: 175, direction: 'min' as const },
      { key: 'carbohydrate', amount: 165, direction: 'target' as const },
      { key: 'fat', amount: 60, direction: 'target' as const }
    ]
    const result = ensureEnergyTarget(targets, make, 2200)
    expect(result.at(-1)).toEqual({ key: 'energy', amount: 2200, direction: 'max' })
  })

  it('derives energy from protein/carbohydrate/fat when calories is absent', async () => {
    const { ensureEnergyTarget } = await import('../../shared/utils/nutritionTargets')
    const targets = [
      { key: 'protein', amount: 175, direction: 'min' as const },
      { key: 'carbohydrate', amount: 165, direction: 'target' as const },
      { key: 'fat', amount: 60, direction: 'target' as const }
    ]
    const result = ensureEnergyTarget(targets, make, null)
    expect(result.at(-1)).toEqual({ key: 'energy', amount: 1900, direction: 'max' })
  })

  it('leaves targets unchanged when a macro row is missing', async () => {
    const { ensureEnergyTarget } = await import('../../shared/utils/nutritionTargets')
    const targets = [
      { key: 'protein', amount: 175, direction: 'min' as const },
      { key: 'carbohydrate', amount: 165, direction: 'target' as const }
    ]
    expect(ensureEnergyTarget(targets, make)).toBe(targets)
  })

  it('takes direction from make, not a fixed default', async () => {
    const { ensureEnergyTarget } = await import('../../shared/utils/nutritionTargets')
    const targets = [{ key: 'protein', amount: 175, direction: 'min' as const }, { key: 'carbohydrate', amount: 165, direction: 'target' as const }, { key: 'fat', amount: 60, direction: 'target' as const }]
    const result = ensureEnergyTarget(targets, (amount) => ({ key: 'energy', amount, direction: 'min' as const }))
    expect(result.at(-1)?.direction).toBe('min')
  })
})
