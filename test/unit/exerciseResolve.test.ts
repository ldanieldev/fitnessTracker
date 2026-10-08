import { describe, expect, it } from 'vitest'
import { resolveExercise } from '../../shared/utils/exerciseResolve'

const category = { id: 1, key: 'chest', name: 'Chest', color: 'rose', sortOrder: 0, shared: true, hidden: false }
const row = {
  id: 7,
  name: 'Barbell Bench Press',
  categoryId: 1,
  trackingType: 'weight_reps' as const,
  loadStyle: 'barbell' as const,
  barWeight: '45',
  difficulty: 'beginner' as const,
  images: ['Barbell_Bench_Press/0.jpg'],
  instructions: ['Lie down.'],
  createdByUserId: null,
  equipment: ['barbell'],
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps']
}

describe('resolveExercise', () => {
  it('uses catalogue values when the user has no prefs', () => {
    const out = resolveExercise(row, null, category)
    expect(out.barWeight).toBe(45)
    expect(out.trackingType).toBe('weight_reps')
    expect(out.favorite).toBe(false)
    expect(out.hidden).toBe(false)
    expect(out.shared).toBe(true)
    expect(out.overridden).toEqual({ category: false, trackingType: false, loadStyle: false, barWeight: false })
  })

  it('lets each pref field win on its own and flags it as overridden', () => {
    const out = resolveExercise(
      row,
      {
        barWeight: '35',
        trackingType: null,
        loadStyle: null,
        categoryId: null,
        weightIncrement: '2.5',
        restSeconds: 180,
        notes: 'Mid grip',
        link: null,
        favorite: true,
        hiddenAt: null
      },
      category
    )
    expect(out.barWeight).toBe(35)
    expect(out.trackingType).toBe('weight_reps')
    expect(out.weightIncrement).toBe(2.5)
    expect(out.restSeconds).toBe(180)
    expect(out.notes).toBe('Mid grip')
    expect(out.favorite).toBe(true)
    expect(out.overridden.barWeight).toBe(true)
    expect(out.overridden.trackingType).toBe(false)
  })

  it('reports hidden when the pref carries a hidden timestamp', () => {
    const out = resolveExercise(
      row,
      {
        barWeight: null,
        trackingType: null,
        loadStyle: null,
        categoryId: null,
        weightIncrement: null,
        restSeconds: null,
        notes: null,
        link: null,
        favorite: false,
        hiddenAt: new Date('2026-09-16T10:00:00Z')
      },
      category
    )
    expect(out.hidden).toBe(true)
  })

  it('drops the bar weight when the user switches the load style away from barbell', () => {
    const out = resolveExercise(
      row,
      {
        barWeight: null,
        trackingType: null,
        loadStyle: 'assisted',
        categoryId: null,
        weightIncrement: null,
        restSeconds: null,
        notes: null,
        link: null,
        favorite: false,
        hiddenAt: null
      },
      category
    )
    expect(out.loadStyle).toBe('assisted')
    expect(out.barWeight).toBe(null)
  })

  it('clears an inherited load style and bar weight once the tracking type stops carrying weight', () => {
    const out = resolveExercise(
      row,
      {
        barWeight: null,
        trackingType: 'reps',
        loadStyle: null,
        categoryId: null,
        weightIncrement: null,
        restSeconds: null,
        notes: null,
        link: null,
        favorite: false,
        hiddenAt: null
      },
      category
    )
    expect(out.loadStyle).toBe(null)
    expect(out.barWeight).toBe(null)
  })

  it('resolves the plate override for barbell exercises only', () => {
    const pref = {
      barWeight: null,
      trackingType: null,
      loadStyle: null,
      categoryId: null,
      weightIncrement: null,
      restSeconds: null,
      notes: null,
      link: null,
      favorite: false,
      hiddenAt: null
    }
    const barbell = resolveExercise(
      { ...row, loadStyle: 'barbell' as const, barWeight: '45' },
      { ...pref, plateSizes: ['55', '45'] },
      category
    )
    expect(barbell.plateSizes).toEqual([55, 45])
    const plain = resolveExercise({ ...row, loadStyle: 'plain' as const }, { ...pref, plateSizes: ['55'] }, category)
    expect(plain.plateSizes).toBeNull()
  })

  it('reads a non-numeric stored number as unknown, never NaN', () => {
    const out = resolveExercise({ ...row, barWeight: 'abc' }, null, category)
    expect(out.barWeight).toBeNull()
  })

  it('marks a user-created exercise as not shared', () => {
    expect(resolveExercise({ ...row, createdByUserId: 3 }, null, category).shared).toBe(false)
  })
})
