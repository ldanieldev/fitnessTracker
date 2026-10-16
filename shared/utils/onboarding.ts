import { RATIO_MACROS } from './nutritionGoals'

export type OnboardingStep = 'about' | 'modules' | 'body' | 'nutrition' | 'workouts' | 'done'

export function onboardingSteps(modules: { body: boolean; workouts: boolean; nutrition: boolean }): OnboardingStep[] {
  return [
    'about',
    'modules',
    ...(modules.body ? (['body'] as const) : []),
    ...(modules.nutrition ? (['nutrition'] as const) : []),
    ...(modules.workouts ? (['workouts'] as const) : []),
    'done'
  ]
}

export interface OnboardingGoalInput {
  inputMode: 'grams' | 'ratio'
  calories: number | null
  protein: number | null
  carbohydrate: number | null
  fat: number | null
}

export function goalProfileBody(input: OnboardingGoalInput) {
  const filled = RATIO_MACROS.filter((macro) => input[macro] != null)
  if (input.calories == null && !filled.length) return null
  const targets: Array<{ nutrient: string; amount?: number; ratioPercent?: number }> =
    input.inputMode === 'ratio'
      ? filled.map((nutrient) => ({ nutrient, ratioPercent: input[nutrient]! }))
      : filled.map((nutrient) => ({ nutrient, amount: input[nutrient]! }))
  return {
    name: 'Default' as const,
    inputMode: input.inputMode,
    calories: input.calories,
    isDefault: true as const,
    // The server needs at least one target; calories alone become the energy target.
    targets: targets.length ? targets : [{ nutrient: 'energy', amount: input.calories! }]
  }
}

function ratioSum(input: OnboardingGoalInput) {
  return RATIO_MACROS.reduce((sum, macro) => sum + (input[macro] ?? 0), 0)
}

export function ratioTotal(input: OnboardingGoalInput) {
  return Math.round(ratioSum(input) * 10) / 10
}

export function ratioGoalError(input: OnboardingGoalInput): string | undefined {
  if (input.inputMode !== 'ratio' || !goalProfileBody(input)) return undefined
  if (input.calories == null || RATIO_MACROS.some((macro) => input[macro] == null)) {
    return 'Ratio goals need calories and all three percentages'
  }
  // 0.5 matches ratioToGrams, so the client refuses exactly what the server would.
  if (Math.abs(ratioSum(input) - 100) > 0.5) return 'Percentages must add up to 100'
  return undefined
}

export function mealNameErrors(
  meals: Array<{ id: number; name: string; draft: string; removed: boolean }>
): Record<number, string> {
  const errors: Record<number, string> = {}
  // Archived meals keep their names under meal_container_user_name_unique, so removed names start out taken.
  const taken = new Set(meals.filter((m) => m.removed).map((m) => m.name.toLowerCase()))
  for (const meal of meals) {
    if (meal.removed) continue
    const name = meal.draft.trim().toLowerCase()
    if (!name) errors[meal.id] = 'Meal names can\'t be empty'
    else if (taken.has(name)) errors[meal.id] = 'Meal names must be different'
    else taken.add(name)
  }
  return errors
}
