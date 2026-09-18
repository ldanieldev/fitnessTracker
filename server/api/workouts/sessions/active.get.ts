import { activeSession } from '~~/server/utils/workouts/sessions'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  return activeSession(userId)
})
