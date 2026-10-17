import { pauseEnrollment } from '~~/server/utils/workouts/enrollments'
import { enrollmentTodaySchema } from '~~/server/utils/workouts/input'
import { parseWith } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = parseWith(enrollmentTodaySchema, (await readBody(event)) ?? {})
  return pauseEnrollment(userId, body.today)
})
