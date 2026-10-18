import { inngest } from '~~/server/utils/inngest/client'
import { logger } from '~~/server/utils/logger'
import { requireAdmin } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const { id: userId } = await requireAdmin(event)
  await inngest.send({ name: 'search/rebuild.requested', data: { userId } })
  logger.info({ event: 'admin.search_rebuild', adminId: userId }, 'admin requested a search rebuild')
  return { ok: true }
})
