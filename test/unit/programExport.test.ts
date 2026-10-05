import { describe, expect, it } from 'vitest'
import { matchImportExercise, programExportSchema } from '../../shared/utils/programExport'

const valid = {
  format: 'mfj-program',
  version: 1,
  program: { name: 'BLS', description: null, phases: [{ name: 'P1', weeks: 8, deload: false, routine: 0 }, { name: 'Off', weeks: 1, deload: false, routine: null }] },
  routines: [{
    name: 'Upper/Lower',
    notes: null,
    days: [{
      name: 'Upper A',
      description: null,
      floating: false,
      entries: [
        { exercise: { externalId: 'Barbell_Squat' }, targetSets: 3, targetLow: 5, targetHigh: 8, targetWeight: null, supersetGroup: null, optional: false, restSeconds: null, notes: null },
        { exercise: { name: 'Cable Fly', trackingType: 'weight_reps', loadStyle: 'plain', barWeight: null, category: { name: 'Chest', color: 'rose' } }, targetSets: 3, targetLow: null, targetHigh: null, targetWeight: null, supersetGroup: 1, optional: true, restSeconds: 90, notes: 'slow' }
      ]
    }]
  }]
}

describe('programExportSchema', () => {
  it('accepts a valid file', () => {
    expect(programExportSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects another format or version', () => {
    expect(programExportSchema.safeParse({ ...valid, format: 'other' }).success).toBe(false)
    expect(programExportSchema.safeParse({ ...valid, version: 2 }).success).toBe(false)
  })

  it('rejects a phase pointing past the routines list', () => {
    const bad = { ...valid, program: { ...valid.program, phases: [{ name: 'P', weeks: 1, deload: false, routine: 3 }] } }
    expect(programExportSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects zero weeks', () => {
    const bad = { ...valid, program: { ...valid.program, phases: [{ name: 'P', weeks: 0, deload: false, routine: null }] } }
    expect(programExportSchema.safeParse(bad).success).toBe(false)
  })
})

describe('matchImportExercise', () => {
  const own = [
    { id: 1, name: 'Cable Fly', trackingType: 'weight_reps' as const },
    { id: 2, name: 'Plank', trackingType: 'time' as const }
  ]

  it('matches by case-insensitive name and tracking type', () => {
    expect(matchImportExercise(own, { name: 'cable fly', trackingType: 'weight_reps' })).toEqual({ kind: 'match', id: 1 })
  })

  it('creates when nothing has the name', () => {
    expect(matchImportExercise(own, { name: 'Dips', trackingType: 'reps' })).toEqual({ kind: 'create', name: 'Dips' })
  })

  it('creates an "(imported)" copy when the name clashes with another tracking type', () => {
    expect(matchImportExercise(own, { name: 'Plank', trackingType: 'reps' })).toEqual({ kind: 'create', name: 'Plank (imported)' })
  })

  it('re-import matches the "(imported)" copy', () => {
    const withCopy = [...own, { id: 3, name: 'Plank (imported)', trackingType: 'reps' as const }]
    expect(matchImportExercise(withCopy, { name: 'Plank', trackingType: 'reps' })).toEqual({ kind: 'match', id: 3 })
  })
})
