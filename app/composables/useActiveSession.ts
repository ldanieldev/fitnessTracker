import type { WorkoutSession } from '~~/shared/types/workout'

export async function useActiveSession() {
  const fetch = useWorkoutFetch<WorkoutSession | null>(
    WORKOUT_KEYS.active,
    '/api/workouts/sessions/active',
    // No open session answers 204, which reaches useFetch as undefined; null keeps it in the payload so the client doesn't refetch.
    { lazy: true, transform: (session: WorkoutSession | null) => session ?? null }
  )
  // Awaiting only on the server keeps client navigation instant while SSR paints the same markup hydration expects.
  if (import.meta.server) await fetch
  const { data: session, status, error, refresh } = fetch
  return { session, status, error, refresh }
}
