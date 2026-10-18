import { createError, getRouterParam, type H3Event } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  boundedRecord,
  calendarDateSchema,
  idParamSchema,
  INT4_MAX,
  nearTodaySchema,
  routeId,
  zId
} from '../../server/utils/validation'
import { isCalendarDate } from '../../shared/utils/calendarDate'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'
import { scaleStoredIngredientSnapshot } from '../../shared/utils/nutritionRecipe'

describe('isCalendarDate', () => {
  it('accepts real days and rejects impossible or malformed ones', () => {
    expect(isCalendarDate('2024-02-29')).toBe(true)
    expect(isCalendarDate('2026-02-29')).toBe(false)
    expect(isCalendarDate('2026-10-99')).toBe(false)
    expect(isCalendarDate('2026-1-01')).toBe(false)
    expect(isCalendarDate('')).toBe(false)
    expect(calendarDateSchema.safeParse('2026-02-30').success).toBe(false)
  })
})

describe('id schemas', () => {
  it('caps body ids at the int4 range', () => {
    expect(zId.safeParse(INT4_MAX).success).toBe(true)
    expect(zId.safeParse(INT4_MAX + 1).success).toBe(false)
    expect(zId.safeParse(0).success).toBe(false)
    expect(zId.safeParse(1.5).success).toBe(false)
  })

  it('accepts only digit strings within range for route params', () => {
    expect(idParamSchema.safeParse('42').data).toBe(42)
    for (const bad of ['abc', '1.5', '-1', '0', '1e3', ' 1', '2147483648', '99999999999', undefined]) {
      expect(idParamSchema.safeParse(bad).success, String(bad)).toBe(false)
    }
  })
})

describe('routeId', () => {
  beforeEach(() => {
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getRouterParam', getRouterParam)
  })
  afterEach(() => vi.unstubAllGlobals())

  const eventWith = (params: Record<string, string>) => ({ path: '/api/x', context: { params } }) as unknown as H3Event

  it('returns the numeric id', () => {
    expect(routeId(eventWith({ id: '7' }))).toBe(7)
    expect(routeId(eventWith({ jobId: '9' }), 'jobId')).toBe(9)
  })

  it('answers 400 for a malformed or out-of-range id', () => {
    for (const id of ['abc', '2147483648', '0']) {
      expect(() => routeId(eventWith({ id }))).toThrow(expect.objectContaining({ statusCode: 400 }))
    }
  })
})

describe('boundedRecord', () => {
  it('rejects too many keys and over-long keys', () => {
    const schema = boundedRecord(z.number(), 2, 8)
    expect(schema.safeParse({ a: 1, b: 2 }).success).toBe(true)
    expect(schema.safeParse({ a: 1, b: 2, c: 3 }).success).toBe(false)
    expect(schema.safeParse({ waytoolongkey: 1 }).success).toBe(false)
  })
})

describe('workout inputs', () => {
  it('requires real calendar dates for session days', async () => {
    const { sessionStartSchema, sessionPatchSchema } = await import('../../server/utils/workouts/input')
    expect(sessionStartSchema.safeParse({ performedOn: '2026-02-30' }).success).toBe(false)
    expect(sessionStartSchema.safeParse({ performedOn: '2026-02-28' }).success).toBe(true)
    expect(sessionPatchSchema.safeParse({ performedOn: '2026-10-99' }).success).toBe(false)
  })

  it('keeps sort orders inside their column ranges', async () => {
    const { categoryPatchSchema, workoutEntryPatchSchema } = await import('../../server/utils/workouts/input')
    expect(categoryPatchSchema.safeParse({ sortOrder: 32_767 }).success).toBe(true)
    expect(categoryPatchSchema.safeParse({ sortOrder: 32_768 }).success).toBe(false)
    expect(workoutEntryPatchSchema.safeParse({ sortOrder: INT4_MAX + 1 }).success).toBe(false)
  })

  it('accepts only http(s) exercise links', async () => {
    const { exercisePrefsSchema } = await import('../../server/utils/workouts/input')
    expect(exercisePrefsSchema.safeParse({ link: 'https://youtu.be/x' }).success).toBe(true)
    expect(exercisePrefsSchema.safeParse({ link: 'http://192.168.1.2/v' }).success).toBe(true)
    for (const link of ['javascript:alert(1)', 'data:text/html,x', 'ftp://a.com/x']) {
      expect(exercisePrefsSchema.safeParse({ link }).success, link).toBe(false)
    }
  })

  it('caps the FitNotes mapping', async () => {
    const { fitNotesImportSchema } = await import('../../server/utils/workouts/fitnotes/input')
    const mapping = Object.fromEntries(Array.from({ length: 2001 }, (_, i) => [`Lift ${i}`, null]))
    expect(fitNotesImportSchema.safeParse({ csv: 'x', mapping }).success).toBe(false)
    expect(fitNotesImportSchema.safeParse({ csv: 'x', mapping: { Squat: INT4_MAX + 1 } }).success).toBe(false)
  })
})

describe('nutrition inputs', () => {
  const entry = { entryType: 'quick_add', containerId: 1, quantity: 1, unitLabel: 'serving' }

  it('caps diary entry batches and nutrient maps', async () => {
    const { entryPostSchema } = await import('../../server/utils/nutrition/entry')
    expect(entryPostSchema.safeParse(Array(100).fill(entry)).success).toBe(true)
    expect(entryPostSchema.safeParse(Array(101).fill(entry)).success).toBe(false)
    const nutrients = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`n${i}`, 1]))
    expect(entryPostSchema.safeParse([{ ...entry, nutrients }]).success).toBe(false)
  })

  it('caps food servings, recipe ingredients and saved meal items', async () => {
    const { foodCreateSchema } = await import('../../server/utils/nutrition/foodInput')
    const { recipeSchema } = await import('../../server/utils/nutrition/recipeInput')
    const { savedMealSchema } = await import('../../server/utils/nutrition/savedMealInput')
    const serving = { kind: 'named', label: 'cup', quantity: 1, basisGrams: 100 }
    expect(foodCreateSchema.safeParse({ name: 'x', servings: Array(51).fill(serving) }).success).toBe(false)
    const item = { foodId: 1, quantity: 1, unitLabel: 'g' }
    const recipe = { name: 'r', servings: 1, servingName: 'serving' }
    expect(recipeSchema.safeParse({ ...recipe, ingredients: Array(200).fill(item) }).success).toBe(true)
    expect(recipeSchema.safeParse({ ...recipe, ingredients: Array(201).fill(item) }).success).toBe(false)
    expect(savedMealSchema.safeParse({ name: 'm', items: Array(101).fill(item) }).success).toBe(false)
  })

  it('rejects a goal profile naming the same nutrient twice', async () => {
    const { goalProfileSchema } = await import('../../server/utils/nutrition/goalInput')
    const base = { name: 'Cut', inputMode: 'grams' }
    const protein = { nutrient: 'protein', amount: 150 }
    expect(goalProfileSchema.safeParse({ ...base, targets: [protein] }).success).toBe(true)
    expect(goalProfileSchema.safeParse({ ...base, targets: [protein, protein] }).success).toBe(false)
  })
})

describe('body inputs', () => {
  it('bounds measurement values and times', async () => {
    const { entryCreateSchema, prefsPutSchema } = await import('../../server/utils/body/input')
    expect(entryCreateSchema.safeParse({ typeId: 1, value: 180.4 }).success).toBe(true)
    expect(entryCreateSchema.safeParse({ typeId: 1, value: 1e300 }).success).toBe(false)
    expect(entryCreateSchema.safeParse({ typeId: 1, value: 1, measuredAt: '275000-01-01T00:00:00Z' }).success).toBe(
      false
    )
    expect(entryCreateSchema.safeParse({ typeId: INT4_MAX + 1, value: 1 }).success).toBe(false)
    expect(prefsPutSchema.safeParse({ sortOrder: INT4_MAX + 1 }).success).toBe(false)
  })
})

describe('program import limits', () => {
  it('caps the distinct custom exercises a program file may create', async () => {
    const { programExportSchema } = await import('../../shared/utils/programExport')
    const entry = (i: number) => ({
      exercise: {
        name: `Lift ${i}`,
        trackingType: 'weight_reps',
        loadStyle: null,
        barWeight: null,
        category: { name: 'Imported', color: 'slate' }
      },
      targetSets: null,
      targetLow: null,
      targetHigh: null,
      targetWeight: null,
      supersetGroup: null,
      optional: false,
      restSeconds: null,
      notes: null
    })
    const file = (count: number) => ({
      format: 'mfj-program',
      version: 1,
      program: { name: 'P', description: null, phases: [] },
      routines: Array.from({ length: Math.ceil(count / 3000) }, (_, r) => ({
        name: `R${r}`,
        notes: null,
        days: Array.from({ length: 30 }, (_, d) => ({
          name: `D${d}`,
          description: null,
          floating: false,
          entries: Array.from({ length: 100 }, (_, e) => entry(r * 3000 + d * 100 + e)).filter(
            (_, e) => r * 3000 + d * 100 + e < count
          )
        }))
      }))
    })
    expect(programExportSchema.safeParse(file(500)).success).toBe(true)
    expect(programExportSchema.safeParse(file(501)).success).toBe(false)
  })
})

describe('scaleStoredIngredientSnapshot', () => {
  it('scales a recipe snapshot and passes other snapshots through', () => {
    const item = { name: 'Oats', quantity: 40, unitLabel: 'g', gramsResolved: 40, nutrients: { energy: 150 } }
    expect(scaleStoredIngredientSnapshot([item], 1.5)).toEqual([
      { ...item, quantity: 60, gramsResolved: 60, nutrients: { energy: 225 } }
    ])
    expect(scaleStoredIngredientSnapshot(null, 2)).toBeNull()
  })
})

describe('nearTodaySchema', () => {
  const fixtures = process.env.NUXT_TEST_FIXTURES
  afterEach(() => {
    process.env.NUXT_TEST_FIXTURES = fixtures
    if (fixtures === undefined) delete process.env.NUXT_TEST_FIXTURES
  })

  it('accepts a day either side of the server date and rejects anything further', () => {
    delete process.env.NUXT_TEST_FIXTURES
    const server = todayDate()
    for (const days of [-1, 0, 1]) expect(nearTodaySchema.safeParse(shiftDate(server, days)).success).toBe(true)
    expect(nearTodaySchema.safeParse(shiftDate(server, 2)).success).toBe(false)
    expect(nearTodaySchema.safeParse(shiftDate(server, -2)).success).toBe(false)
    expect(nearTodaySchema.safeParse('2999-01-01').success).toBe(false)
  })

  it('lets e2e builds simulate any date', () => {
    process.env.NUXT_TEST_FIXTURES = '1'
    expect(nearTodaySchema.safeParse('2999-01-01').success).toBe(true)
    expect(nearTodaySchema.safeParse('2026-02-30').success).toBe(false)
  })
})
