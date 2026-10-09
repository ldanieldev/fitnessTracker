import { listSessions } from '~~/server/utils/workouts/sessions'
import { sessionListQuerySchema } from '~~/server/utils/workouts/input'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const query = parseQuery(event, sessionListQuerySchema)
  return listSessions(userId, query)
})
