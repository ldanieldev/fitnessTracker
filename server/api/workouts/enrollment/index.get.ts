import { loadEnrollment } from '~~/server/utils/workouts/enrollments'
import { enrollmentQuerySchema } from '~~/server/utils/workouts/input'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { today } = parseQuery(event, enrollmentQuerySchema)
  return loadEnrollment(userId, today)
})
