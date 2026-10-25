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
    expect(nutrientFields(tracked).map((f) => f.key)).toEqual([
      'energy',
      'protein',
      'carbohydrate',
      'fat',
      'fiber',
      'sodium'
    ])
  })

  it('validates like the old form', async () => {
    const { draftError, emptyDraft } = await import('../../app/utils/nutrition/servingDraft')
    expect(draftError({ ...emptyDraft(), kind: 'weight', label: 'g', quantity: 100 })).toBe(
      'A weight serving must carry its own nutrition'
    )
    expect(draftError({ ...emptyDraft(), label: 'slice' })).toBe(
      'A serving without its own nutrition needs a gram weight'
    )
    expect(draftError({ ...emptyDraft(), label: 'slice', basisGrams: '40' })).toBeNull()
    expect(draftError({ ...emptyDraft(), label: '', nutrients: { energy: '90' } })).toBe('A serving needs a label')
    expect(draftError({ ...emptyDraft(), label: 'slice', quantity: 0, nutrients: { energy: '90' } })).toBe(
      'Quantity must be more than 0'
    )
    expect(draftError({ ...emptyDraft(), label: 'slice', basisGrams: '0' })).toBe(
      'A serving without its own nutrition needs a gram weight'
    )
  })

  it('omits blank fields and never sends basisGrams for a weight serving', async () => {
    const { draftToInput, emptyDraft } = await import('../../app/utils/nutrition/servingDraft')
    expect(
      draftToInput({
        ...emptyDraft(),
        label: ' slice ',
        basisGrams: '40',
        nutrients: { fiber: '', protein: '0' }
      })
    ).toEqual({ kind: 'named', label: 'slice', quantity: 1, basisGrams: 40, nutrients: { energy: 0, protein: 0 } })
    expect(
      draftToInput({
        ...emptyDraft(),
        kind: 'weight',
        label: 'g',
        quantity: 100,
        basisGrams: '100',
        nutrients: { fat: '10' }
      })
    ).toEqual({ kind: 'weight', label: 'g', quantity: 100, nutrients: { fat: 10, energy: 90 } })
    expect(draftToInput({ ...emptyDraft(), label: 'slice', basisGrams: '40' })).toEqual({
      kind: 'named',
      label: 'slice',
      quantity: 1,
      basisGrams: 40
    })
    expect(
      draftToInput({ ...emptyDraft(), label: 'slice', basisGrams: '0', nutrients: { protein: '9' } })
    ).not.toHaveProperty('basisGrams')
  })

  it('round-trips a stored serving through its nutrient keys', async () => {
    const { draftFromServing } = await import('../../app/utils/nutrition/servingDraft')
    const draft = draftFromServing(
      {
        id: 7,
        kind: 'named',
        label: 'slice',
        quantity: 1,
        basisGrams: 40,
        hasOwnNutrition: true,
        nutrients: { 1: 85, 2: 1, 5: 2.5 }
      },
      new Map([
        [1, 'energy'],
        [2, 'protein'],
        [5, 'fiber']
      ])
    )
    expect(draft).toEqual({
      kind: 'named',
      label: 'slice',
      quantity: 1,
      basisGrams: '40',
      nutrients: { protein: '1', fiber: '2.5' }
    })
  })

  it('rounds stored nutrient amounts to one decimal for editing', async () => {
    const { draftFromServing } = await import('../../app/utils/nutrition/servingDraft')
    const draft = draftFromServing(
      {
        id: 7,
        kind: 'weight',
        label: 'g',
        quantity: 100,
        basisGrams: 100,
        hasOwnNutrition: true,
        nutrients: { 1: 107.00327868852459, 2: 0.3333333333333333, 3: 0.19999999999999998 }
      },
      new Map([
        [1, 'energy'],
        [2, 'protein'],
        [3, 'carbohydrate']
      ])
    )
    expect(draft.nutrients).toEqual({ protein: '0.3', carbohydrate: '0.2' })
  })

  it('applies only parsed nutrients that have a field', async () => {
    const { applyParsedNutrients, emptyDraft, nutrientFields } = await import('../../app/utils/nutrition/servingDraft')
    const fields = nutrientFields(tracked.slice(0, 3))
    const out = applyParsedNutrients(emptyDraft(), { energy: 230, fiber: 4, sodium: 120 }, fields)
    expect(out.nutrients).toEqual({ fiber: '4' })
  })

  it('always sets energy from the macros, over a typed value', async () => {
    const { draftToInput, emptyDraft } = await import('../../app/utils/nutrition/servingDraft')
    const out = draftToInput({
      ...emptyDraft(),
      label: 'slice',
      basisGrams: '40',
      nutrients: { energy: '999', protein: '3', carbohydrate: '2', fat: '5' }
    })
    expect(out.nutrients?.energy).toBe(65)
  })

  it('sends no nutrients for a named serving with only a gram weight', async () => {
    const { draftToInput, emptyDraft } = await import('../../app/utils/nutrition/servingDraft')
    expect(draftToInput({ ...emptyDraft(), label: 'slice', basisGrams: '30' })).not.toHaveProperty('nutrients')
  })

  it('reports the calculated energy of a draft, null without own nutrients', async () => {
    const { servingEnergy, emptyDraft } = await import('../../app/utils/nutrition/servingDraft')
    expect(servingEnergy({ ...emptyDraft(), nutrients: { protein: '3', carbohydrate: '2', fat: '5' } })).toBe(65)
    expect(servingEnergy(emptyDraft())).toBeNull()
    expect(servingEnergy({ ...emptyDraft(), nutrients: { energy: '90' } })).toBeNull()
  })

  it('calculates energy as 0 when only a non-macro nutrient is present', async () => {
    const { draftToInput, emptyDraft } = await import('../../app/utils/nutrition/servingDraft')
    const out = draftToInput({ ...emptyDraft(), label: 'slice', basisGrams: '40', nutrients: { sodium: '120' } })
    expect(out.nutrients).toEqual({ sodium: 120, energy: 0 })
  })

  it('fills only blank fields of a weight serving, scaled from per-100 g to its grams', async () => {
    const { fillDraftFromPer100g, nutrientFields } = await import('../../app/utils/nutrition/servingDraft')
    const { draft, filledKeys } = fillDraftFromPer100g(
      { kind: 'weight', label: 'oz', quantity: 1, basisGrams: '', nutrients: { sodium: '150', protein: '' } },
      { energy: 500, protein: 10, fiber: 3.333, sugar: 20 },
      nutrientFields(tracked)
    )
    expect(draft.nutrients).toEqual({ sodium: '150', protein: '2.8', fiber: '0.9' })
    expect(filledKeys).toEqual(['protein', 'fiber'])
  })

  it('scales a named serving by its gram weight and leaves gramless or derived servings alone', async () => {
    const { fillDraftFromPer100g, nutrientFields } = await import('../../app/utils/nutrition/servingDraft')
    const fields = nutrientFields(tracked)
    const per100g = { energy: 400, fiber: 5 }
    const bar = fillDraftFromPer100g(
      { kind: 'named', label: 'bar', quantity: 1, basisGrams: '40', nutrients: { sodium: '160' } },
      per100g,
      fields
    )
    expect(bar.draft.nutrients).toEqual({ sodium: '160', fiber: '2' })
    const gramless = fillDraftFromPer100g(
      { kind: 'named', label: 'cup', quantity: 1, basisGrams: '', nutrients: { sodium: '90' } },
      per100g,
      fields
    )
    expect(gramless.filledKeys).toEqual([])
    const derived = fillDraftFromPer100g(
      { kind: 'named', label: 'slice', quantity: 1, basisGrams: '30', nutrients: {} },
      per100g,
      fields
    )
    expect(derived.filledKeys).toEqual([])
  })

  it('never fills energy from per-100 g values', async () => {
    const { fillDraftFromPer100g, draftFromPer100g, nutrientFields } = await import(
      '../../app/utils/nutrition/servingDraft'
    )
    const fields = nutrientFields(tracked)
    const out = fillDraftFromPer100g(
      { kind: 'weight', label: 'g', quantity: 100, basisGrams: '', nutrients: { fiber: '1' } },
      { energy: 566.7, protein: 1, carbohydrate: 17, fat: 11 },
      fields
    )
    expect(out.filledKeys).toEqual(['protein', 'carbohydrate', 'fat'])
    expect(out.draft.nutrients).not.toHaveProperty('energy')
    expect(draftFromPer100g({ energy: 200 }, fields).nutrients).toEqual({})
  })

  it('builds a 100 g weight serving from per-100 g values for the shown fields', async () => {
    const { draftFromPer100g, nutrientFields } = await import('../../app/utils/nutrition/servingDraft')
    expect(draftFromPer100g({ energy: 539.04, protein: 6.33, sugar: 56 }, nutrientFields(tracked))).toEqual({
      kind: 'weight',
      label: 'g',
      quantity: 100,
      basisGrams: '',
      nutrients: { protein: '6.3' }
    })
  })
})
