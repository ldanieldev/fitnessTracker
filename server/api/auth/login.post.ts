import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '~~/server/db/schema'
import { emailSchema } from '~~/shared/utils/email'
import {
  clearLimit,
  clientIp,
  consumeLimits,
  RATE_RULES,
  refundLimits,
  type RateCheck
} from '~~/server/utils/rateLimit/limit'
import { writeSession } from '~~/server/utils/session'
import { toSessionUser } from '~~/server/utils/sessionUser'

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1)
})

let dummyHash: Promise<string> | undefined

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: z.flattenError(parsed.error)
    })
  }

  const ipLimit: RateCheck = [RATE_RULES.loginIp, clientIp(event)]
  await consumeLimits(event, [ipLimit, [RATE_RULES.loginEmail, parsed.data.email]])

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1)
    .then((r) => r[0])

  // An unknown email still pays for one verify, so response time doesn't reveal which emails have accounts.
  const hash = user?.password ?? (await (dummyHash ??= hashPassword('timing-equaliser-not-a-password')))
  const valid = await verifyPassword(hash, parsed.data.password)

  if (!user?.password || !valid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid email or password'
    })
  }

  await Promise.all([clearLimit(RATE_RULES.loginEmail, parsed.data.email), refundLimits([ipLimit])])

  if (user.isActive === false) throw createError({ statusCode: 403, statusMessage: 'Account disabled' })

  await writeSession(event, toSessionUser(user), user.sessionEpoch)

  return { success: true }
})
