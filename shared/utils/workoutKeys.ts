export const WORKOUT_KEYS = {
  active: 'workouts:session:active',
  session: (id: number) => `workouts:session:${id}`,
  sessions: 'workouts:sessions:',
  history: (id: number, limit: number) => `workouts:history:${id}:${limit}`,
  series: (id: number, metric: string, reps: number | null, range: string) =>
    `workouts:series:${id}:${metric}:${reps ?? 'x'}:${range}`,
  records: (id: number) => `workouts:records:${id}`,
  progress: (range: string) => `workouts:progress:${range}`,
  routines: 'workouts:routines',
  routine: (id: number) => `workouts:routine:${id}`
} as const

export function sessionListKey(limit: number, filterQuery = ''): string {
  return `${WORKOUT_KEYS.sessions}${limit}${filterQuery ? `:${filterQuery}` : ''}`
}

export function sessionMonthKey(from: string, to: string, filterQuery: string): string {
  return `${WORKOUT_KEYS.sessions}month:${from}:${to}:${filterQuery}`
}
