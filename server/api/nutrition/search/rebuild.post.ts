import { inngest } from '~~/server/utils/inngest/client'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  await inngest.send({ name: 'search/rebuild.requested', data: { userId } })
  return { ok: true }
})
