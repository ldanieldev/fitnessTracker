import type { Enrollment, StartWhen } from '~~/shared/types/program'
import { todayDate } from '~~/shared/utils/nutritionSummary'

export function useEnrollment() {
  const stored = useToday()
  const today = computed(() => stored.value ?? todayDate())
  const fetch = useWorkoutFetch<Enrollment | null>(
    WORKOUT_KEYS.enrollment,
    () => `/api/workouts/enrollment?today=${today.value}`,
    // 204 reaches useFetch as undefined; client-only because "today" is the device's local date.
    { lazy: true, server: false, transform: (value: Enrollment | null) => value ?? null }
  )

  async function post(path: string, body: Record<string, unknown> = {}) {
    const result = await apiFetch<Enrollment | null>(`/api/workouts/${path}`, {
      method: 'POST',
      body: { today: today.value, ...body }
    })
    await invalidateWorkouts()
    return result ?? null
  }

  return {
    enrollment: fetch.data,
    status: fetch.status,
    today,
    enroll: (programId: number, when: StartWhen, replace = false) =>
      post(`programs/${programId}/enroll`, { when, replace }),
    pause: () => post('enrollment/pause'),
    resume: (when: StartWhen) => post('enrollment/resume', { when }),
    end: () => post('enrollment/end'),
    dismiss: () => post('enrollment/dismiss-notice')
  }
}
