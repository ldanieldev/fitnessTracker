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
