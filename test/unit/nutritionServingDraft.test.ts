import { describe, expect, it } from 'vitest'

const tracked = [
  { key: 'energy', name: 'Calories', unit: 'kcal' },
  { key: 'protein', name: 'Protein', unit: 'g' },
  { key: 'fiber', name: 'Fiber', unit: 'g' },
  { key: 'sodium', name: 'Sodium', unit: 'mg' }
]

describe('servingDraft', () => {
  it('lists the four macros first, then tracked extras once each', async () => {
    const { nutrientFields } = await import('../../app/utils/nutrition/servingDraft')
    expect(nutrientFields(tracked).map((f) => f.key)).toEqual(['energy', 'protein', 'carbohydrate', 'fat', 'fiber', 'sodium'])
  })

  it('validates like the old form', async () => {
    const { draftError, emptyDraft } = await import('../../app/utils/nutrition/servingDraft')
    expect(draftError({ ...emptyDraft(), kind: 'weight', label: 'g', quantity: 100 })).toBe('A weight serving must carry its own nutrition')
    expect(draftError({ ...emptyDraft(), label: 'slice' })).toBe('A serving without its own nutrition needs a gram weight')
    expect(draftError({ ...emptyDraft(), label: 'slice', basisGrams: '40' })).toBeNull()
    expect(draftError({ ...emptyDraft(), label: '', nutrients: { energy: '90' } })).toBe('A serving needs a label')
    expect(draftError({ ...emptyDraft(), label: 'slice', quantity: 0, nutrients: { energy: '90' } })).toBe('Quantity must be more than 0')
    expect(draftError({ ...emptyDraft(), label: 'slice', basisGrams: '0' })).toBe('A serving without its own nutrition needs a gram weight')
  })

  it('omits blank fields and never sends basisGrams for a weight serving', async () => {
    const { draftToInput, emptyDraft } = await import('../../app/utils/nutrition/servingDraft')
    expect(draftToInput({ ...emptyDraft(), label: ' slice ', basisGrams: '40', nutrients: { energy: '90', fiber: '', protein: '0' } }))
      .toEqual({ kind: 'named', label: 'slice', quantity: 1, basisGrams: 40, nutrients: { energy: 90, protein: 0 } })
    expect(draftToInput({ ...emptyDraft(), kind: 'weight', label: 'g', quantity: 100, basisGrams: '100', nutrients: { energy: '260' } }))
      .toEqual({ kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 260 } })
    expect(draftToInput({ ...emptyDraft(), label: 'slice', basisGrams: '40' })).toEqual({ kind: 'named', label: 'slice', quantity: 1, basisGrams: 40 })
    expect(draftToInput({ ...emptyDraft(), label: 'slice', basisGrams: '0', nutrients: { energy: '90' } })).not.toHaveProperty('basisGrams')
  })

  it('round-trips a stored serving through its nutrient keys', async () => {
    const { draftFromServing } = await import('../../app/utils/nutrition/servingDraft')
    const draft = draftFromServing(
      { id: 7, kind: 'named', label: 'slice', quantity: 1, basisGrams: 40, hasOwnNutrition: true, nutrients: { 1: 90, 5: 2.5 } },
      new Map([[1, 'energy'], [5, 'fiber']])
    )
    expect(draft).toEqual({ kind: 'named', label: 'slice', quantity: 1, basisGrams: '40', nutrients: { energy: '90', fiber: '2.5' } })
  })

  it('applies only parsed nutrients that have a field', async () => {
    const { applyParsedNutrients, emptyDraft, nutrientFields } = await import('../../app/utils/nutrition/servingDraft')
    const fields = nutrientFields(tracked.slice(0, 3))
    const out = applyParsedNutrients(emptyDraft(), { energy: 230, fiber: 4, sodium: 120 }, fields)
    expect(out.nutrients).toEqual({ energy: '230', fiber: '4' })
  })

  it('derives energy from macros when calories is left blank', async () => {
    const { draftToInput, emptyDraft } = await import('../../app/utils/nutrition/servingDraft')
    const out = draftToInput({ ...emptyDraft(), label: 'slice', basisGrams: '40', nutrients: { protein: '7', carbohydrate: '0', fat: '5' } })
    expect(out.nutrients).toEqual({ protein: 7, carbohydrate: 0, fat: 5, energy: 73 })
  })

  it('leaves a typed calorie value untouched', async () => {
    const { draftToInput, emptyDraft } = await import('../../app/utils/nutrition/servingDraft')
    const out = draftToInput({ ...emptyDraft(), label: 'slice', basisGrams: '40', nutrients: { protein: '7', carbohydrate: '0', fat: '5', energy: '999' } })
    expect(out.nutrients).toEqual({ protein: 7, carbohydrate: 0, fat: 5, energy: 999 })
  })

  it('adds no energy key when no macros are present', async () => {
    const { draftToInput, emptyDraft } = await import('../../app/utils/nutrition/servingDraft')
    const out = draftToInput({ ...emptyDraft(), label: 'slice', basisGrams: '40', nutrients: { sodium: '120' } })
    expect(out.nutrients).toEqual({ sodium: 120 })
  })
})
