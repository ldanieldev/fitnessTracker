import { describe, expect, it } from 'vitest'
import { loadPlan, roundToIncrement, roundToLoadable } from '../../app/utils/plateCalculator'

const DEFAULTS = [45, 35, 25, 10, 5, 2.5]

describe('loadPlan', () => {
  it('loads an exact weight with the fewest plates, heaviest first', () => {
    expect(loadPlan(135, 45, DEFAULTS).exact).toEqual({ perSide: [45], total: 135 })
    expect(loadPlan(145, 45, DEFAULTS).exact).toEqual({ perSide: [45, 5], total: 145 })
  })

  it('loads largest-first rather than with the fewest plates', () => {
    expect(loadPlan(190, 45, [55, 45, 35, 25, 10, 5, 2.5]).exact).toEqual({ perSide: [55, 10, 5, 2.5], total: 190 })
  })

  it('skips a plate too heavy for the remainder', () => {
    expect(loadPlan(135, 45, [55, 45, 25, 10, 5, 2.5]).exact).toEqual({ perSide: [45], total: 135 })
  })

  it('finds loads a greedy fill misses', () => {
    expect(loadPlan(165, 45, [45, 35, 25]).exact).toEqual({ perSide: [35, 25], total: 165 })
  })

  it('uses an exercise override such as 55 lb bumpers', () => {
    expect(loadPlan(315, 45, [55, 45, 25, 10, 5, 2.5]).exact).toEqual({ perSide: [55, 55, 25], total: 315 })
  })

  it('treats the bar alone as an exact load', () => {
    expect(loadPlan(45, 45, DEFAULTS)).toEqual({
      belowBar: false,
      exact: { perSide: [], total: 45 },
      below: null,
      above: null
    })
  })

  it('offers the nearest loads either side when the target cannot be made', () => {
    const plan = loadPlan(227, 45, DEFAULTS)
    expect(plan.exact).toBeNull()
    expect(plan.below).toEqual({ perSide: [45, 45], total: 225 })
    expect(plan.above).toEqual({ perSide: [45, 45, 2.5], total: 230 })
  })

  it('flags a target below the bar', () => {
    const plan = loadPlan(40, 45, DEFAULTS)
    expect(plan.belowBar).toBe(true)
    expect(plan.exact).toBeNull()
  })

  it('handles fractional plates on the hundredths grid', () => {
    expect(loadPlan(47.5, 45, [1.25]).exact).toEqual({ perSide: [1.25], total: 47.5 })
  })

  it('gives up past the per-side cap instead of allocating huge arrays', () => {
    expect(loadPlan(999999, 45, DEFAULTS)).toEqual({ belowBar: false, exact: null, below: null, above: null })
  })

  it('still plans a target at the 2000 lb ceiling', () => {
    expect(loadPlan(2045, 45, DEFAULTS).exact).toEqual({
      perSide: [45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 10],
      total: 2045
    })
  })
})

describe('roundToLoadable', () => {
  it('picks the nearer loadable weight and rounds ties down', () => {
    expect(roundToLoadable(222.7, 45, DEFAULTS)).toBe(225)
    expect(roundToLoadable(196.5, 45, DEFAULTS)).toBe(195)
    expect(roundToLoadable(227.5, 45, DEFAULTS)).toBe(225)
  })

  it('returns the bar for a target below it', () => {
    expect(roundToLoadable(30, 45, DEFAULTS)).toBe(45)
  })
})

describe('roundToIncrement', () => {
  it('rounds to the nearest step with ties down', () => {
    expect(roundToIncrement(222.7, 5)).toBe(225)
    expect(roundToIncrement(222.5, 5)).toBe(220)
    expect(roundToIncrement(101.3, 2.5)).toBe(102.5)
  })
})
