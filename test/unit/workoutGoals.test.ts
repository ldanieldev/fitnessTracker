import { describe, expect, it } from 'vitest'
import { goalReached, workoutGoalProgress } from '../../shared/utils/workoutGoals'

describe('goalReached', () => {
  it('needs the target met or beaten', () => {
    expect(goalReached(225, 225, false)).toBe(true)
    expect(goalReached(220, 225, false)).toBe(false)
    expect(goalReached(null, 225, false)).toBe(false)
  })

  it('inverts for a lower-is-better metric', () => {
    expect(goalReached(20, 25, true)).toBe(true)
    expect(goalReached(30, 25, true)).toBe(false)
  })
})

describe('workoutGoalProgress', () => {
  it('is the fraction of the target reached, clamped', () => {
    expect(workoutGoalProgress(180, 225, false)).toBeCloseTo(0.8, 5)
    expect(workoutGoalProgress(250, 225, false)).toBe(1)
    expect(workoutGoalProgress(null, 225, false)).toBe(0)
  })

  it('measures a lower-is-better goal from the other side', () => {
    expect(workoutGoalProgress(25, 25, true)).toBe(1)
    expect(workoutGoalProgress(50, 25, true)).toBeCloseTo(0.5, 5)
  })
})
