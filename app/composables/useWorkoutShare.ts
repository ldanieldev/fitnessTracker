import type { WorkoutSession } from '~~/shared/types/workout'
import { workoutShareText } from '~~/shared/utils/workoutShare'
import { errorMessage } from '~/utils/apiError'
import { shareWorkout } from '~/utils/shareWorkout'

export function useWorkoutShare() {
  const toast = useToast()
  const manualOpen = ref(false)
  const manualText = ref('')

  async function shareSession(session: WorkoutSession) {
    const text = workoutShareText(session)
    const outcome = await shareWorkout(text)
    if (outcome === 'copied') toast.add({ title: 'Copied workout', color: 'success' })
    if (outcome === 'manual') {
      manualText.value = text
      manualOpen.value = true
    }
  }

  async function shareById(id: number) {
    try {
      await shareSession(await apiFetch<WorkoutSession>(`/api/workouts/sessions/${id}`))
    } catch (err: unknown) {
      toast.add({ title: 'Share failed', description: errorMessage(err, 'Could not load this workout'), color: 'error' })
    }
  }

  return { manualOpen, manualText, shareSession, shareById }
}
