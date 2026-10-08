import { listExercisesForUser } from '~~/server/utils/workouts/exercises'
import { exerciseQuerySchema } from '~~/server/utils/workouts/input'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const query = parseQuery(event, exerciseQuerySchema)
  const exercises = await listExercisesForUser(userId, { ...query, muscles: undefined, limit: undefined })
  return [...new Set(exercises.flatMap((e) => [...e.primaryMuscles, ...e.secondaryMuscles]))].sort()
})
