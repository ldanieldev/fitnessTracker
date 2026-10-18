import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { googleHealthConnections } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { connectionStatus, loadConnection } from '~~/server/utils/googleHealth/connection'
import { logger } from '~~/server/utils/logger'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { forbidToken, requireUserId } from '~~/server/utils/session'

const bodySchema = z
  .object({ syncSteps: z.boolean().optional(), pushWeight: z.boolean().optional() })
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update')

export default defineEventHandler(async (event) => {
  forbidToken(event)
  const userId = await requireUserId(event)
  const body = await parseBody(event, bodySchema)
  if (!(await loadConnection(userId))) {
    throw createError({ statusCode: 404, statusMessage: 'Google Health is not connected' })
  }
  await db.update(googleHealthConnections).set(body).where(eq(googleHealthConnections.userId, userId))
  logger.info({ userId, syncSteps: body.syncSteps, pushWeight: body.pushWeight }, 'Google Health settings changed')
  return connectionStatus(userId)
})
