import { startSession } from '~~/server/utils/workouts/sessions'
import { sessionStartSchema } from '~~/server/utils/workouts/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, sessionStartSchema)
  return startSession(userId, body)
})
