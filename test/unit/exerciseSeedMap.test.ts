import { describe, expect, it } from 'vitest'
import {
  barWeightFor,
  categoryKeyFor,
  difficultyFor,
  loadStyleFor,
  trackingTypeFor
} from '../../shared/utils/exerciseSeedMap'

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'Test_Exercise',
  name: 'Test Exercise',
  category: 'strength',
  equipment: 'barbell',
  level: 'beginner',
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  instructions: ['Do the thing.'],
  images: ['Test_Exercise/0.jpg'],
  ...over
})

describe('exercise seed mapping', () => {
  it('maps a barbell press to chest, weight+reps, barbell load, 45 lb bar', () => {
    const e = entry()
    expect(categoryKeyFor(e)).toBe('chest')
    expect(trackingTypeFor(e)).toBe('weight_reps')
    expect(loadStyleFor(e)).toBe('barbell')
    expect(barWeightFor(e)).toBe(45)
  })

  it('gives an e-z curl bar a 25 lb bar', () => {
    expect(barWeightFor(entry({ equipment: 'e-z curl bar' }))).toBe(25)
  })

  it('maps a body-only strength exercise to reps only with no load style', () => {
    const e = entry({ equipment: 'body only', primaryMuscles: ['lats'] })
    expect(categoryKeyFor(e)).toBe('back')
    expect(trackingTypeFor(e)).toBe('reps')
    expect(loadStyleFor(e)).toBe(null)
    expect(barWeightFor(e)).toBe(null)
  })

  it('maps dataset cardio to the cardio category and distance+time', () => {
    const e = entry({ category: 'cardio', equipment: 'machine', primaryMuscles: ['quadriceps'] })
    expect(categoryKeyFor(e)).toBe('cardio')
    expect(trackingTypeFor(e)).toBe('distance_time')
  })

  it('maps stretching to time only', () => {
    expect(trackingTypeFor(entry({ category: 'stretching', equipment: null }))).toBe('time')
  })

  it('maps a weight exercise without equipment to plain load', () => {
    const e = entry({ equipment: null, primaryMuscles: ['triceps'] })
    expect(categoryKeyFor(e)).toBe('arms')
    expect(loadStyleFor(e)).toBe('plain')
  })

  it('renames expert to advanced and keeps the other levels', () => {
    expect(difficultyFor(entry({ level: 'expert' }))).toBe('advanced')
    expect(difficultyFor(entry({ level: 'intermediate' }))).toBe('intermediate')
    expect(difficultyFor(entry({ level: undefined }))).toBe(null)
  })

  it('files every dataset muscle under a category', () => {
    const muscles = [
      'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes', 'hamstrings',
      'lats', 'lower back', 'middle back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps'
    ]
    for (const m of muscles) {
      expect(categoryKeyFor(entry({ primaryMuscles: [m] })), m)
        .toMatch(/^(chest|back|shoulders|arms|legs|core|neck|cardio)$/)
    }
  })
})
