import { dismissEnrollmentNotice } from '~~/server/utils/workouts/enrollments'
import { enrollmentPauseSchema } from '~~/server/utils/workouts/input'
import { parseWith } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = parseWith(enrollmentPauseSchema, (await readBody(event)) ?? {})
  return dismissEnrollmentNotice(userId, body.today)
})
