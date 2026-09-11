import type { ServingBasis } from '~~/shared/types/nutrition'
import { NUTRITION_MACROS } from '~~/app/constants/nutrition'
import { numOrUndefined } from '~~/app/composables/useNutritionForms'

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

export function nutrientFields(tracked: Array<{ key: string, name: string, unit: string }>): NutrientField[] {
  const macros: NutrientField[] = NUTRITION_MACROS.map((m) => ({ key: m.key, name: m.name, unit: m.unit }))
  const seen = new Set(macros.map((m) => m.key))
  return [...macros, ...tracked.filter((t) => !seen.has(t.key)).map((t) => ({ key: t.key, name: t.name, unit: t.unit }))]
}

function numericNutrients(draft: ServingDraft): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, raw] of Object.entries(draft.nutrients)) {
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
  if (!hasNutrients && positiveGrams(draft.basisGrams) === undefined) return 'A serving without its own nutrition needs a gram weight'
  return null
}

export function draftToInput(draft: ServingDraft): ServingInputBody {
  const nutrients = numericNutrients(draft)
  const basisGrams = draft.kind === 'named' ? positiveGrams(draft.basisGrams) : undefined
  return {
    kind: draft.kind,
    label: draft.label.trim(),
    quantity: draft.quantity,
    ...(basisGrams !== undefined ? { basisGrams } : {}),
    ...(Object.keys(nutrients).length ? { nutrients } : {})
  }
}

export function draftFromServing(serving: ServingBasis, idToKey: Map<number, string>): ServingDraft {
  const nutrients: Record<string, string> = {}
  for (const [id, amount] of Object.entries(serving.nutrients)) {
    const key = idToKey.get(Number(id))
    if (key) nutrients[key] = String(amount)
  }
  return {
    kind: serving.kind,
    label: serving.label,
    quantity: serving.quantity,
    basisGrams: serving.basisGrams === null ? '' : String(serving.basisGrams),
    nutrients
  }
}

export function applyParsedNutrients(draft: ServingDraft, parsed: Partial<Record<string, number>>, fields: NutrientField[]): ServingDraft {
  const nutrients = { ...draft.nutrients }
  for (const field of fields) {
    const value = parsed[field.key]
    if (value !== undefined) nutrients[field.key] = String(value)
  }
  return { ...draft, nutrients }
}
