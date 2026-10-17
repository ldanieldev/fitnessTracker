import type { Enrollment, StartWhen } from '~~/shared/types/program'
import { todayDate } from '~~/shared/utils/nutritionSummary'

export function useEnrollment() {
  const stored = useToday()
  const today = computed(() => stored.value ?? todayDate())
  const fetch = useAsyncData(
    WORKOUT_KEYS.enrollment,
    () =>
      apiFetch<Enrollment | null>('/api/workouts/enrollment/sync', { method: 'POST', body: { today: today.value } }),
    // A 204 resolves as undefined; client-only because "today" is the device's local date.
    { lazy: true, server: false, watch: [today], dedupe: 'defer', transform: (value) => value ?? null }
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
