import { describe, expect, it } from 'vitest'
import {
  goalProfileBody,
  mealNameErrors,
  onboardingSteps,
  ratioGoalError,
  ratioTotal
} from '../../shared/utils/onboarding'

describe('onboardingSteps', () => {
  it('includes every module step when all are on', () => {
    expect(onboardingSteps({ body: true, workouts: true, nutrition: true }))
      .toEqual(['about', 'modules', 'body', 'nutrition', 'workouts', 'done'])
  })

  it('drops the steps of disabled modules', () => {
    expect(onboardingSteps({ body: false, workouts: true, nutrition: false }))
      .toEqual(['about', 'modules', 'workouts', 'done'])
    expect(onboardingSteps({ body: false, workouts: false, nutrition: false })).toEqual(['about', 'modules', 'done'])
  })
})

describe('goalProfileBody', () => {
  const blank = { inputMode: 'grams' as const, calories: null, protein: null, carbohydrate: null, fat: null }

  it('returns null when nothing was entered', () => {
    expect(goalProfileBody(blank)).toBeNull()
  })

  it('sends grams macros as amounts and calories alongside', () => {
    expect(goalProfileBody({ ...blank, calories: 2200, protein: 180, fat: 70 })).toEqual({
      name: 'Default',
      inputMode: 'grams',
      calories: 2200,
      isDefault: true,
      targets: [{ nutrient: 'protein', amount: 180 }, { nutrient: 'fat', amount: 70 }]
    })
  })

  it('sends calories alone as an energy target', () => {
    expect(goalProfileBody({ ...blank, calories: 2200 })?.targets).toEqual([{ nutrient: 'energy', amount: 2200 }])
  })

  it('sends ratio macros as percentages', () => {
    expect(goalProfileBody({ inputMode: 'ratio', calories: 2000, protein: 40, carbohydrate: 30, fat: 30 })).toEqual({
      name: 'Default',
      inputMode: 'ratio',
      calories: 2000,
      isDefault: true,
      targets: [
        { nutrient: 'protein', ratioPercent: 40 },
        { nutrient: 'carbohydrate', ratioPercent: 30 },
        { nutrient: 'fat', ratioPercent: 30 }
      ]
    })
  })
})

describe('ratioGoalError', () => {
  const ratio = { inputMode: 'ratio' as const, calories: 2000, protein: 40, carbohydrate: 30, fat: 30 }

  it('accepts a complete ratio goal that sums to 100, and anything in grams mode', () => {
    expect(ratioGoalError(ratio)).toBeUndefined()
    expect(ratioGoalError({ ...ratio, inputMode: 'grams', calories: null })).toBeUndefined()
  })

  it('accepts an empty ratio goal, which saves nothing', () => {
    expect(ratioGoalError({ ...ratio, calories: null, protein: null, carbohydrate: null, fat: null })).toBeUndefined()
  })

  it('needs calories and all three percentages', () => {
    expect(ratioGoalError({ ...ratio, calories: null })).toBe('Ratio goals need calories and all three percentages')
    expect(ratioGoalError({ ...ratio, fat: null })).toBe('Ratio goals need calories and all three percentages')
  })

  it('needs the percentages to sum to 100 within the server tolerance', () => {
    expect(ratioGoalError({ ...ratio, fat: 20 })).toBe('Percentages must add up to 100')
    expect(ratioGoalError({ ...ratio, fat: 30.4 })).toBeUndefined()
    expect(ratioTotal({ ...ratio, protein: 33.3, carbohydrate: 33.3, fat: 33.4 })).toBe(100)
  })
})

describe('mealNameErrors', () => {
  const meal = (id: number, name: string, draft = name, removed = false) => ({ id, name, draft, removed })

  it('flags blank names and later duplicates, ignoring case and spaces', () => {
    expect(mealNameErrors([meal(1, 'A', 'Lunch'), meal(2, 'B', 'lunch '), meal(3, 'C', '  ')])).toEqual({
      2: 'Meal names must be different',
      3: 'Meal names can\'t be empty'
    })
  })

  it('treats a removed meal\'s name as taken and skips removed rows', () => {
    expect(mealNameErrors([meal(1, 'Snack', '', true), meal(2, 'B', 'snack')])).toEqual({
      2: 'Meal names must be different'
    })
  })
})
