import { describe, expect, it } from 'vitest'
import { calendarDots, monthRange } from '../../shared/utils/workoutCalendar'

describe('monthRange', () => {
  it('pads a week on each side so outside-month grid days have data', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-09-24', to: '2026-11-07' })
    expect(monthRange('2026-01')).toEqual({ from: '2025-12-25', to: '2026-02-07' })
    expect(monthRange('2028-02')).toEqual({ from: '2028-01-25', to: '2028-03-07' })
  })
})

describe('calendarDots', () => {
  const chest = { id: 1, color: 'rose' }
  const back = { id: 2, color: 'amber' }
  const legs = { id: 3, color: 'emerald' }
  const arms = { id: 4, color: 'violet' }
  const core = { id: 5, color: 'sky' }

  it('unions categories across a day\'s workouts in first-appearance order', () => {
    const map = calendarDots([
      { performedOn: '2026-10-01', categories: [chest, back] },
      { performedOn: '2026-10-01', categories: [back, legs] }
    ])
    expect(map.get('2026-10-01')).toEqual({ dots: [chest, back, legs], more: false })
  })

  it('caps at max and flags more', () => {
    const map = calendarDots([{ performedOn: '2026-10-02', categories: [chest, back, legs, arms, core] }])
    expect(map.get('2026-10-02')).toEqual({ dots: [chest, back, legs, arms], more: true })
  })

  it('draws no dot for a workout with no exercises', () => {
    const map = calendarDots([{ performedOn: '2026-10-03', categories: [] }])
    expect(map.get('2026-10-03')).toBeUndefined()
  })
})
