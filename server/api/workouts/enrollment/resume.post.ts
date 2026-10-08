import { resumeEnrollment } from '~~/server/utils/workouts/enrollments'
import { enrollmentResumeSchema } from '~~/server/utils/workouts/input'
import { parseWith } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = parseWith(enrollmentResumeSchema, (await readBody(event)) ?? {})
  return resumeEnrollment(userId, body)
})
