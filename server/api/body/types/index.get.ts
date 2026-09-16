import { listTypesForUser } from '~~/server/utils/body/types'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const includeHidden = getQuery(event).includeHidden === '1'
  return listTypesForUser(userId, { includeHidden })
})
