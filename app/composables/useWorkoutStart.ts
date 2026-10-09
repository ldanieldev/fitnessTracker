import type { PointerChoice, WorkoutSession } from '~~/shared/types/workout'
import { todayDate } from '~~/shared/utils/nutritionSummary'

export interface WorkoutStartBody {
  routineDayId?: number
  pointer?: PointerChoice
  copyFromId?: number
  entryIds?: number[]
}

export function useWorkoutStart() {
  const toast = useToast()
  const fail = useFailToast()
  const starting = ref(false)

  async function start(body: WorkoutStartBody): Promise<WorkoutSession | null> {
    if (starting.value) return null
    starting.value = true
    try {
      const session = await apiFetch<WorkoutSession>('/api/workouts/sessions', {
        method: 'POST',
        body: { ...body, performedOn: todayDate() }
      })
      await invalidateWorkouts()
      return session
    } catch (err: unknown) {
      const open = (err as { data?: { data?: { session?: WorkoutSession | null } } }).data?.data?.session ?? null
      if (open) {
        toast.add({ title: 'A workout is already open', description: 'Finish it before starting another.', color: 'warning' })
        await invalidateWorkouts()
        return open
      }
      fail('Couldn\'t start workout', err, 'Could not start this workout')
      return null
    } finally {
      starting.value = false
    }
  }

  return { start, starting }
}
