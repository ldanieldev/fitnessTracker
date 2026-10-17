import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { authProviders, users } from '~~/server/db/schema'
import { emailSchema } from '~~/shared/utils/email'
import { isUniqueViolation } from '~~/server/utils/pgError'
import { forbidToken, isTokenRequest, requireSessionUser, writeSession } from '~~/server/utils/session'
import { toSessionUser } from '~~/server/utils/sessionUser'
import { publicUserColumns } from '~~/server/utils/userColumns'
import { rebuildUserRollups, repCapFor } from '~~/server/utils/workouts/rollups'
import { normalizePlateSizes, plateSizesSchema } from '~~/shared/utils/plates'
import { routeId } from '~~/server/utils/validation'

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: emailSchema.optional(),
  age: z.coerce.number().min(13).max(120).optional(),
  sex: z.enum(['m', 'f']).optional(),
  heightIn: z.number().min(36).max(96).nullable().optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  weekStart: z.union([z.literal(0), z.literal(1)]).optional(),
  defaultRestSeconds: z.number().int().min(10).max(600).optional(),
  plateSizes: plateSizesSchema.optional(),
  oneRepMaxRepCap: z.number().int().min(1).max(20).optional(),
  workoutsPerWeek: z.number().int().min(1).max(7).optional(),
  showBody: z.boolean().optional(),
  showWorkouts: z.boolean().optional(),
  showNutrition: z.boolean().optional()
})

const roundTenth = (value: number) => Math.round(value * 10) / 10

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)

  const id = routeId(event)

  if (sessionUser.id !== id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)
  const parsed = updateProfileSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation Error',
      data: z.flattenError(parsed.error)
    })
  }

  if (parsed.data.email !== undefined) forbidToken(event)

  // Check email uniqueness if changed
  if (parsed.data.email !== undefined && parsed.data.email !== sessionUser.email) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1)
      .then((r) => r[0])

    if (existing) {
      throw createError({ statusCode: 409, statusMessage: 'Email already in use' })
    }
  }

  // Read before the update, and from the DB rather than the session cookie, which can be stale or predate the column.
  const currentRepCap = parsed.data.oneRepMaxRepCap !== undefined ? await repCapFor(id) : undefined

  const user = await db
    .transaction(async (tx) => {
      const updated = await tx
        .update(users)
        .set({
          name: parsed.data.name,
          email: parsed.data.email,
          age: parsed.data.age,
          sex: parsed.data.sex,
          heightIn: parsed.data.heightIn == null ? parsed.data.heightIn : String(roundTenth(parsed.data.heightIn)),
          avatarUrl: parsed.data.avatarUrl !== undefined ? parsed.data.avatarUrl || null : undefined,
          weekStart: parsed.data.weekStart,
          defaultRestSeconds: parsed.data.defaultRestSeconds,
          plateSizes: parsed.data.plateSizes ? normalizePlateSizes(parsed.data.plateSizes).map(String) : undefined,
          oneRepMaxRepCap: parsed.data.oneRepMaxRepCap,
          workoutsPerWeek: parsed.data.workoutsPerWeek,
          showBody: parsed.data.showBody,
          showWorkouts: parsed.data.showWorkouts,
          showNutrition: parsed.data.showNutrition
        })
        .where(eq(users.id, id))
        .returning(publicUserColumns)
        .then((r) => r[0]!)
      if (parsed.data.email !== undefined) {
        await tx
          .update(authProviders)
          .set({ providerAccountId: updated.email })
          .where(and(eq(authProviders.userId, id), eq(authProviders.provider, 'credentials')))
      }
      return updated
    })
    .catch((error: unknown) => {
      if (isUniqueViolation(error, 'users_email_unique')) {
        throw createError({ statusCode: 409, statusMessage: 'Email already in use' })
      }
      throw error
    })

  // Rollups store bestE1rm computed with the old cap, so a cap change invalidates every one of this user's rows.
  if (parsed.data.oneRepMaxRepCap !== undefined && parsed.data.oneRepMaxRepCap !== currentRepCap) {
    await rebuildUserRollups(id)
  }

  // A token must never mint a browser session.
  if (!isTokenRequest(event)) {
    const epoch = (await getUserSession(event)).secure?.epoch ?? 0
    await writeSession(event, toSessionUser(user), epoch)
  }

  return user
})
