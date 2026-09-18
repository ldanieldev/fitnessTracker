export const WORKOUT_KEYS = {
  active: 'workouts:session:active',
  session: (id: number) => `workouts:session:${id}`,
  sessions: 'workouts:sessions:'
} as const

export function sessionListKey(limit: number): string {
  return `${WORKOUT_KEYS.sessions}${limit}`
}
