import { z } from 'zod'
import { googleHealthConnections, stepDays } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { googleHealthConfig } from '~~/server/utils/googleHealth/config'
import { encryptToken } from '~~/server/utils/googleHealth/crypto'
import { GOOGLE_HEALTH_SCOPES } from '~~/server/utils/googleHealth/scopes'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

const bodySchema = z.object({
  refreshToken: z.string().default('stub-refresh'),
  scopes: z.array(z.string()).default(GOOGLE_HEALTH_SCOPES),
  syncSteps: z.boolean().default(false),
  pushWeight: z.boolean().default(false),
  status: z.enum(['active', 'reconnect_required']).default('active'),
  googleStepDays: z.array(z.object({ day: z.string(), steps: z.number().int() })).default([])
})

export default defineEventHandler(async (event) => {
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  const userId = await requireUserId(event)
  const body = await parseBody(event, bodySchema)
  const values = {
    googleSub: `stub-${userId}`,
    googleEmail: `stub-${userId}@example.com`,
    refreshTokenEnc: encryptToken(body.refreshToken, googleHealthConfig().tokenKey),
    scopes: body.scopes,
    syncSteps: body.syncSteps,
    pushWeight: body.pushWeight,
    status: body.status,
    syncStartedAt: null,
    lastError: null
  }
  await db
    .insert(googleHealthConnections)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: googleHealthConnections.userId, set: values })
  for (const d of body.googleStepDays) {
    await db
      .insert(stepDays)
      .values({ userId, day: d.day, steps: d.steps, source: 'google' })
      .onConflictDoUpdate({ target: [stepDays.userId, stepDays.day], set: { steps: d.steps, source: 'google' } })
  }
  return { ok: true }
})
