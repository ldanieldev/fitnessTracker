import { describe, expect, it, beforeEach } from 'vitest'

describe('useWorkoutSession', () => {
  let session: ReturnType<typeof import('../../app/composables/useWorkoutSession')['useWorkoutSession']>

  beforeEach(async () => {
    const mod = await import('../../app/composables/useWorkoutSession')
    session = mod.useWorkoutSession()
  })

  it('should initialize with empty exercises', () => {
    expect(session.exercises.value).toEqual([])
  })

  it('should add a strength exercise', () => {
    session.addExercise({ id: 1, name: 'Bench Press', type: 'strength' })

    expect(session.exercises.value).toHaveLength(1)
    expect(session.exercises.value[0].name).toBe('Bench Press')
    expect(session.exercises.value[0].type).toBe('strength')
    expect(session.exercises.value[0].sets).toEqual([])
    expect(session.exercises.value[0].collapsed).toBe(false)
  })

  it('should add a cardio exercise', () => {
    session.addExercise({ id: 3, name: 'Treadmill', type: 'cardio' })

    expect(session.exercises.value[0].type).toBe('cardio')
    expect(session.exercises.value[0].cardioLog).toEqual({
      durationMinutes: undefined,
      distance: undefined,
      distanceUnit: 'km',
      calories: undefined,
      logged: false
    })
  })

  it('should remove an exercise by index', () => {
    session.addExercise({ id: 1, name: 'Bench Press', type: 'strength' })
    session.addExercise({ id: 2, name: 'Squats', type: 'strength' })
    session.removeExercise(0)

    expect(session.exercises.value).toHaveLength(1)
    expect(session.exercises.value[0].name).toBe('Squats')
  })

  it('should toggle collapse state', () => {
    session.addExercise({ id: 1, name: 'Bench Press', type: 'strength' })

    expect(session.exercises.value[0].collapsed).toBe(false)
    session.toggleCollapse(0)
    expect(session.exercises.value[0].collapsed).toBe(true)
    session.toggleCollapse(0)
    expect(session.exercises.value[0].collapsed).toBe(false)
  })

  it('should log a set for a strength exercise', () => {
    session.addExercise({ id: 1, name: 'Bench Press', type: 'strength' })
    session.logSet(0, { weight: 225, reps: 5, rpe: 7 })

    expect(session.exercises.value[0].sets).toHaveLength(1)
    expect(session.exercises.value[0].sets[0]).toEqual({
      setNumber: 1,
      weight: 225,
      reps: 5,
      rpe: 7,
      note: '',
      logged: true
    })
  })

  it('should auto-increment set numbers', () => {
    session.addExercise({ id: 1, name: 'Bench Press', type: 'strength' })
    session.logSet(0, { weight: 225, reps: 5, rpe: 7 })
    session.logSet(0, { weight: 225, reps: 5, rpe: 8 })

    expect(session.exercises.value[0].sets[0].setNumber).toBe(1)
    expect(session.exercises.value[0].sets[1].setNumber).toBe(2)
  })

  it('should delete a set by index', () => {
    session.addExercise({ id: 1, name: 'Bench Press', type: 'strength' })
    session.logSet(0, { weight: 225, reps: 5, rpe: 7 })
    session.logSet(0, { weight: 225, reps: 3, rpe: 9 })
    session.deleteSet(0, 0)

    expect(session.exercises.value[0].sets).toHaveLength(1)
    expect(session.exercises.value[0].sets[0].setNumber).toBe(1)
  })

  it('should log cardio data', () => {
    session.addExercise({ id: 3, name: 'Treadmill', type: 'cardio' })
    session.logCardio(0, { durationMinutes: 30, distance: 5, distanceUnit: 'km', calories: 300 })

    expect(session.exercises.value[0].cardioLog).toEqual({
      durationMinutes: 30,
      distance: 5,
      distanceUnit: 'km',
      calories: 300,
      logged: true
    })
  })

  it('should load mock data for initial state', () => {
    session.loadMockData()

    expect(session.exercises.value).toHaveLength(3)
    expect(session.exercises.value[0].name).toBe('Barbell Bench Press')
    expect(session.exercises.value[0].sets).toHaveLength(2)
    expect(session.exercises.value[1].name).toBe('Squats')
    expect(session.exercises.value[1].sets).toHaveLength(0)
    expect(session.exercises.value[2].name).toBe('Treadmill')
    expect(session.exercises.value[2].type).toBe('cardio')
  })
})
