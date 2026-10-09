import type { Exercise } from '~~/shared/types/workout'
import type { ExerciseFormPayload } from '~/components/workout/ExerciseForm.vue'
import { errorMessage } from '~/utils/apiError'

export function useExerciseSave() {
  const nameError = ref<string | null>(null)
  const toast = useToast()

  async function save(payload: ExerciseFormPayload, editingId: number | null): Promise<Exercise | null> {
    try {
      const saved = editingId !== null
        ? await apiFetch<Exercise>(`/api/workouts/exercises/${editingId}`, { method: 'PUT', body: payload })
        : await apiFetch<Exercise>('/api/workouts/exercises', { method: 'POST', body: payload })
      await invalidateExercises()
      toast.add({ title: 'Saved', color: 'success' })
      return saved
    } catch (error: unknown) {
      if (error instanceof Error && 'statusCode' in error && (error as { statusCode?: number }).statusCode === 409) {
        nameError.value = errorMessage(error, 'You already have an exercise with that name')
        return null
      }
      toast.add({
        title: 'Save failed',
        description: errorMessage(error, 'Could not save this exercise'),
        color: 'error'
      })
      return null
    }
  }

  return { nameError, save }
}
