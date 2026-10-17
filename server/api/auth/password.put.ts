import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '~~/server/db/schema'
import { overwritePassword } from '~~/server/utils/admin/accounts'
import { consumeLimits, RATE_RULES, refundLimits, type RateCheck } from '~~/server/utils/rateLimit/limit'
import { forbidToken, requireSessionUser, writeSession } from '~~/server/utils/session'

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  forbidToken(event)

  const body = await readBody(event)
  const parsed = changePasswordSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: z.flattenError(parsed.error)
    })
  }

  const user = await db
    .select({ id: users.id, password: users.password })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1)
    .then((r) => r[0]!)

  if (user.password) {
    if (!parsed.data.currentPassword) {
      throw createError({ statusCode: 400, statusMessage: 'Current password is required' })
    }
    const limits: RateCheck[] = [[RATE_RULES.passwordChange, String(user.id)]]
    await consumeLimits(event, limits)
    const valid = await verifyPassword(user.password, parsed.data.currentPassword)
    // Not 401: apiFetch reads any 401 as an expired session and signs the user out.
    if (!valid) throw createError({ statusCode: 400, statusMessage: 'Current password is incorrect' })
    await refundLimits(limits)
  }

  const sessionEpoch = await overwritePassword(db, sessionUser.id, await hashPassword(parsed.data.newPassword))
  await writeSession(event, sessionUser, sessionEpoch)

  return { success: true }
})
