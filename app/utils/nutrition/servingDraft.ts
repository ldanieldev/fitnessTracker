import type { MassUnit, ServingBasis } from '~~/shared/types/nutrition'
import { NUTRITION_MACROS } from '~~/app/constants/nutrition'
import { numOrUndefined } from '~~/app/composables/useNutritionForms'
import { calculatedEnergy } from '~~/shared/utils/nutritionDerive'
import { toGrams } from '~~/shared/utils/nutritionUnits'

export interface NutrientField {
  key: string
  name: string
  unit: string
}

export interface ServingDraft {
  kind: 'weight' | 'named'
  label: string
  quantity: number
  basisGrams: string
  nutrients: Record<string, string>
}

export interface ServingInputBody {
  kind: 'weight' | 'named'
  label: string
  quantity: number
  basisGrams?: number
  nutrients?: Record<string, number>
}

export function emptyDraft(): ServingDraft {
  return { kind: 'named', label: '', quantity: 1, basisGrams: '', nutrients: {} }
}

export function nutrientFields(tracked: Array<{ key: string; name: string; unit: string }>): NutrientField[] {
  const macros: NutrientField[] = NUTRITION_MACROS.map((m) => ({ key: m.key, name: m.name, unit: m.unit }))
  const seen = new Set(macros.map((m) => m.key))
  return [
    ...macros,
    ...tracked.filter((t) => !seen.has(t.key)).map((t) => ({ key: t.key, name: t.name, unit: t.unit }))
  ]
}

function numericNutrients(draft: ServingDraft): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, raw] of Object.entries(draft.nutrients)) {
    if (key === 'energy') continue
    const value = numOrUndefined(raw.trim())
    if (value !== undefined) out[key] = value
  }
  return out
}

function positiveGrams(raw: string): number | undefined {
  const value = numOrUndefined(raw.trim())
  return value !== undefined && value > 0 ? value : undefined
}

export function draftError(draft: ServingDraft): string | null {
  if (draft.label.trim() === '') return 'A serving needs a label'
  if (!(draft.quantity > 0)) return 'Quantity must be more than 0'
  const hasNutrients = Object.keys(numericNutrients(draft)).length > 0
  if (draft.kind === 'weight' && !hasNutrients) return 'A weight serving must carry its own nutrition'
  if (!hasNutrients && positiveGrams(draft.basisGrams) === undefined)
    return 'A serving without its own nutrition needs a gram weight'
  return null
}

export function draftToInput(draft: ServingDraft): ServingInputBody {
  const nutrients = numericNutrients(draft)
  if (Object.keys(nutrients).length > 0) nutrients.energy = calculatedEnergy(nutrients)
  const basisGrams = draft.kind === 'named' ? positiveGrams(draft.basisGrams) : undefined
  return {
    kind: draft.kind,
    label: draft.label.trim(),
    quantity: draft.quantity,
    ...(basisGrams !== undefined ? { basisGrams } : {}),
    ...(Object.keys(nutrients).length ? { nutrients } : {})
  }
}

export function servingEnergy(draft: ServingDraft): number | null {
  const nutrients = numericNutrients(draft)
  return Object.keys(nutrients).length > 0 ? calculatedEnergy(nutrients) : null
}

function oneDecimal(amount: number): string {
  return String(Math.round(amount * 10) / 10)
}

export function draftFromServing(serving: ServingBasis, idToKey: Map<number, string>): ServingDraft {
  const nutrients: Record<string, string> = {}
  for (const [id, amount] of Object.entries(serving.nutrients)) {
    const key = idToKey.get(Number(id))
    if (key && key !== 'energy') nutrients[key] = oneDecimal(amount)
  }
  return {
    kind: serving.kind,
    label: serving.label,
    quantity: serving.quantity,
    basisGrams: serving.basisGrams === null ? '' : String(serving.basisGrams),
    nutrients
  }
}

export function applyParsedNutrients(
  draft: ServingDraft,
  parsed: Partial<Record<string, number>>,
  fields: NutrientField[]
): ServingDraft {
  const nutrients = { ...draft.nutrients }
  for (const field of fields) {
    const value = parsed[field.key]
    if (field.key !== 'energy' && value !== undefined) nutrients[field.key] = String(value)
  }
  return { ...draft, nutrients }
}

function draftGrams(draft: ServingDraft): number | undefined {
  if (draft.kind === 'weight') return draft.quantity > 0 ? toGrams(draft.quantity, draft.label as MassUnit) : undefined
  return positiveGrams(draft.basisGrams)
}

function fillBlanks(
  draft: ServingDraft,
  grams: number,
  per100g: Partial<Record<string, number>>,
  fields: NutrientField[]
): { draft: ServingDraft; filledKeys: string[] } {
  const nutrients = { ...draft.nutrients }
  const filledKeys: string[] = []
  for (const field of fields) {
    const value = per100g[field.key]
    if (field.key === 'energy' || value === undefined || (nutrients[field.key] ?? '').trim() !== '') continue
    nutrients[field.key] = oneDecimal((value * grams) / 100)
    filledKeys.push(field.key)
  }
  return { draft: { ...draft, nutrients }, filledKeys }
}

export function fillDraftFromPer100g(
  draft: ServingDraft,
  per100g: Partial<Record<string, number>>,
  fields: NutrientField[]
): { draft: ServingDraft; filledKeys: string[] } {
  const grams = draftGrams(draft)
  // A serving with no nutrients of its own derives them from the weight serving; filling it would cut that link.
  if (grams === undefined || Object.keys(numericNutrients(draft)).length === 0) return { draft, filledKeys: [] }
  return fillBlanks(draft, grams, per100g, fields)
}

export function draftFromPer100g(per100g: Partial<Record<string, number>>, fields: NutrientField[]): ServingDraft {
  return fillBlanks({ kind: 'weight', label: 'g', quantity: 100, basisGrams: '', nutrients: {} }, 100, per100g, fields)
    .draft
}
