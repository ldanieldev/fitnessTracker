import type { WorkoutProgress } from '~~/shared/types/workout'
import { workoutProgressQuerySchema } from '~~/server/utils/workouts/input'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { earliestRollup, workoutProgress } from '~~/server/utils/workouts/progress'
import { requireUserId } from '~~/server/utils/session'
import { todayDate } from '~~/shared/utils/nutritionSummary'

export default defineEventHandler(async (event): Promise<WorkoutProgress> => {
  const userId = await requireUserId(event)
  const query = parseQuery(event, workoutProgressQuerySchema)
  const to = query.to ?? todayDate()
  const from = query.from ?? (await earliestRollup(userId)) ?? to
  return workoutProgress(userId, from, to)
})
