import { pauseEnrollment } from '~~/server/utils/workouts/enrollments'
import { enrollmentPauseSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, enrollmentPauseSchema)
  return pauseEnrollment(userId, body.today)
})
