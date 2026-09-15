export type TargetDirection = 'min' | 'max' | 'target'
export type NutrientUnit = 'kcal' | 'g' | 'mg' | 'mcg'
export type ServingKind = 'weight' | 'named'
export type MassUnit = 'g' | 'oz' | 'lb'
export type ServingOrigin = 'import' | 'user'
export type EntryType = 'food' | 'quick_add' | 'recipe'
export type GoalInputMode = 'grams' | 'ratio'

export type NutrientKey =
  | 'energy'
  | 'protein'
  | 'carbohydrate'
  | 'fat'
  | 'fiber'
  | 'sugar'
  | 'saturatedFat'
  | 'cholesterol'
  | 'sodium'
  | 'potassium'

export type NormalizedUnit =
  | { kind: 'weight', unit: MassUnit }
  | { kind: 'named', label: string }

export interface ServingBasis {
  id: number
  kind: ServingKind
  label: string
  quantity: number
  basisGrams: number | null
  hasOwnNutrition: boolean
  nutrients: Record<number, number>
}

export interface FoodForResolve {
  id: number
  servings: ServingBasis[]
}

export type UnitSelection =
  | { type: 'mass', unit: MassUnit }
  | { type: 'serving', servingId: number }

export interface ResolveResult {
  nutrients: Record<number, number>
  gramsResolved: number | null
}

export type MacroSet = { kcal: number, protein: number, carbs: number, fat: number }

export interface ImportWarning {
  date: string
  code: 'checksum' | 'inconsistent_group' | 'oz_as_fluid' | 'duplicate_date' | 'unsupported_unit'
  message: string
}

export interface ImportResult {
  days: number
  entries: number
  entriesSkipped: number
  foodsCreated: number
  foodsReused: number
  containersCreated: number
  warnings: ImportWarning[]
  failedFiles: Array<{ fileName: string, error: string }>
}
