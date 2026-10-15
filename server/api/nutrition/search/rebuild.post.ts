import { inngest } from '~~/server/utils/inngest/client'
import { requireAdmin } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const { id: userId } = await requireAdmin(event)
  await inngest.send({ name: 'search/rebuild.requested', data: { userId } })
  return { ok: true }
})
