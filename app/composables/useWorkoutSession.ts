import { ref, readonly } from 'vue'
import type { WorkoutExercise, DistanceUnit } from '../types/workout'

export function useWorkoutSession() {
  const exercises = ref<WorkoutExercise[]>([])

  function addExercise(exercise: { id: number, name: string, type: 'strength' | 'cardio' }) {
    exercises.value.push({
      ...exercise,
      sets: [],
      cardioLog: {
        durationMinutes: undefined,
        distance: undefined,
        distanceUnit: 'km',
        calories: undefined,
        logged: false
      },
      collapsed: false
    })
  }

  function removeExercise(index: number) {
    exercises.value.splice(index, 1)
  }

  function toggleCollapse(index: number) {
    const exercise = exercises.value[index]
    if (exercise) {
      exercise.collapsed = !exercise.collapsed
    }
  }

  function logSet(exerciseIndex: number, data: { weight: number, reps: number, rpe: number }) {
    const exercise = exercises.value[exerciseIndex]
    if (!exercise) return
    const setNumber = exercise.sets.length + 1
    exercise.sets.push({
      setNumber,
      weight: data.weight,
      reps: data.reps,
      rpe: data.rpe,
      note: '',
      logged: true
    })
  }

  function deleteSet(exerciseIndex: number, setIndex: number) {
    const exercise = exercises.value[exerciseIndex]
    if (!exercise) return
    exercise.sets.splice(setIndex, 1)
    exercise.sets.forEach((set, i) => {
      set.setNumber = i + 1
    })
  }

  function updateSet(exerciseIndex: number, setIndex: number, data: { weight: number, reps: number, rpe: number }) {
    const exercise = exercises.value[exerciseIndex]
    if (!exercise) return
    const set = exercise.sets[setIndex]
    if (!set) return
    set.weight = data.weight
    set.reps = data.reps
    set.rpe = data.rpe
  }

  function updateSetNote(exerciseIndex: number, setIndex: number, note: string) {
    const exercise = exercises.value[exerciseIndex]
    if (!exercise) return
    const set = exercise.sets[setIndex]
    if (!set) return
    set.note = note
  }

  function logCardio(exerciseIndex: number, data: { durationMinutes: number, distance: number, distanceUnit: DistanceUnit, calories: number }) {
    const exercise = exercises.value[exerciseIndex]
    if (!exercise) return
    exercise.cardioLog = { ...data, logged: true }
  }

  function loadMockData() {
    exercises.value = [
      {
        id: 1,
        name: 'Barbell Bench Press',
        type: 'strength',
        sets: [
          { setNumber: 1, weight: 185, reps: 8, rpe: 6, note: '', logged: true },
          { setNumber: 2, weight: 205, reps: 6, rpe: 7, note: '', logged: true }
        ],
        cardioLog: { durationMinutes: undefined, distance: undefined, distanceUnit: 'km', calories: undefined, logged: false },
        collapsed: false
      },
      {
        id: 2,
        name: 'Squats',
        type: 'strength',
        sets: [],
        cardioLog: { durationMinutes: undefined, distance: undefined, distanceUnit: 'km', calories: undefined, logged: false },
        collapsed: false
      },
      {
        id: 3,
        name: 'Treadmill',
        type: 'cardio',
        sets: [],
        cardioLog: { durationMinutes: undefined, distance: undefined, distanceUnit: 'km', calories: undefined, logged: false },
        collapsed: false
      }
    ]
  }

  return {
    exercises: readonly(exercises),
    addExercise,
    removeExercise,
    toggleCollapse,
    logSet,
    deleteSet,
    updateSet,
    updateSetNote,
    logCardio,
    loadMockData
  }
}
