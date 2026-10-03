import { describe, expect, it } from 'vitest'
import { activeFilterCount, filterFromRoute, filterToRoute, sessionFilterParams } from '../../shared/utils/sessionFilter'

describe('sessionFilterParams', () => {
  it('is empty for no filter', () => {
    expect(sessionFilterParams({})).toBe('')
  })

  it('sorts categories and sends match=all only with 2+ categories', () => {
    expect(sessionFilterParams({ categories: [5, 3], match: 'all' })).toBe('categories=3%2C5&match=all')
    expect(sessionFilterParams({ categories: [5], match: 'all' })).toBe('categories=5')
  })

  it('drops thresholds without an exercise and keeps dates', () => {
    expect(sessionFilterParams({ minWeight: 100, minReps: 5 })).toBe('')
    expect(sessionFilterParams({ from: '2026-01-01', to: '2026-02-01', exerciseId: 12, minWeight: 225, minReps: 5 }))
      .toBe('from=2026-01-01&to=2026-02-01&exerciseId=12&minWeight=225&minReps=5')
  })
})

describe('route round-trip', () => {
  it('reads what it writes', () => {
    const filter = { categories: [3, 5], match: 'all' as const, exerciseId: 12, minWeight: 225, minReps: 5 }
    expect(filterToRoute(filter)).toEqual({ cat: '3,5', match: 'all', ex: '12', w: '225', r: '5' })
    expect(filterFromRoute(filterToRoute(filter))).toEqual(filter)
  })

  it('ignores junk instead of throwing', () => {
    expect(filterFromRoute({ cat: 'a,-1,4', match: 'nope', ex: 'x', w: '-5', r: '0' })).toEqual({ categories: [4] })
    expect(filterFromRoute({ w: '100' })).toEqual({})
    expect(filterFromRoute({ cat: ['3', '4'] })).toEqual({})
  })
})

describe('activeFilterCount', () => {
  it('counts categories and the exercise rule once each', () => {
    expect(activeFilterCount({})).toBe(0)
    expect(activeFilterCount({ categories: [1, 2] })).toBe(1)
    expect(activeFilterCount({ categories: [1], exerciseId: 3, minReps: 5 })).toBe(2)
  })
})
