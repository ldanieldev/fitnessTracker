import type { WorkoutSession } from '~~/shared/types/workout'
import { workoutShareText } from '~~/shared/utils/workoutShare'
import { shareWorkout } from '~/utils/shareWorkout'

export function useWorkoutShare() {
  const toast = useToast()
  const fail = useFailToast()
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
      fail('Share failed', err, 'Could not load this workout')
    }
  }

  return { manualOpen, manualText, shareSession, shareById }
}
