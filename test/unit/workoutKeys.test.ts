import { describe, expect, it } from 'vitest'
import { WORKOUT_KEYS, sessionListKey } from '../../shared/utils/workoutKeys'

describe('workout keys', () => {
  it('namespaces every key so one prefix invalidates the module', () => {
    expect(WORKOUT_KEYS.active.startsWith('workouts:session')).toBe(true)
    expect(WORKOUT_KEYS.session(4).startsWith('workouts:session')).toBe(true)
    expect(sessionListKey(20).startsWith('workouts:sessions:')).toBe(true)
  })

  it('separates sessions from each other and page sizes from each other', () => {
    expect(WORKOUT_KEYS.session(4)).not.toBe(WORKOUT_KEYS.session(5))
    expect(sessionListKey(20)).not.toBe(sessionListKey(40))
  })

  it('keys routines under the workouts prefix', () => {
    expect(WORKOUT_KEYS.routines).toBe('workouts:routines')
    expect(WORKOUT_KEYS.routine(4)).toBe('workouts:routine:4')
  })
})
