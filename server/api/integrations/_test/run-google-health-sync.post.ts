import { z } from 'zod'
import { runSyncJob } from '~~/server/utils/googleHealth/sync'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

const bodySchema = z.object({ full: z.boolean().default(false) })

export default defineEventHandler(async (event) => {
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  const userId = await requireUserId(event)
  const { full } = await parseBody(event, bodySchema)
  return runSyncJob(userId, { full })
})
