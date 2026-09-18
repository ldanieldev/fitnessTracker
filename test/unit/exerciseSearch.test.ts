import { describe, expect, it } from 'vitest'
import { matchesTerms, rankExercise } from '../../shared/utils/exerciseSearch'

describe('exercise search', () => {
  it('requires every term to appear somewhere in the name', () => {
    expect(matchesTerms('Dumbbell Bench Press', 'dum press')).toBe(true)
    expect(matchesTerms('Dumbbell Bench Press', 'dum squat')).toBe(false)
  })

  it('ignores case and extra whitespace', () => {
    expect(matchesTerms('Barbell Squat', '  BARBELL   squat ')).toBe(true)
  })

  it('matches everything on an empty query', () => {
    expect(matchesTerms('Anything', '')).toBe(true)
  })

  it('ranks favourites ahead of non-favourites', () => {
    expect(rankExercise('Bench Press', 'bench', true)).toBeLessThan(rankExercise('Bench Press', 'bench', false))
  })

  it('ranks a word-start match ahead of a match inside a word', () => {
    expect(rankExercise('Press Machine', 'press', false)).toBeLessThan(rankExercise('Leg Press', 'press', false))
    expect(rankExercise('Leg Press', 'press', false)).toBeLessThan(rankExercise('Bench Depress', 'press', false))
  })
})
