import { eq, getTableColumns } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '~~/server/db/schema'
import { requireSessionUser } from '~~/server/utils/session'
import { toSessionUser } from '~~/server/utils/sessionUser'
import { rebuildRollups, repCapFor } from '~~/server/utils/workouts/rollups'
import { normalizePlateSizes, plateSizesSchema } from '~~/shared/utils/plates'

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  age: z.coerce.number().min(13).max(120).optional(),
  sex: z.enum(['m', 'f']).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  weekStart: z.union([z.literal(0), z.literal(1)]).optional(),
  defaultRestSeconds: z.number().int().min(10).max(600).optional(),
  plateSizes: plateSizesSchema.optional(),
  oneRepMaxRepCap: z.number().int().min(1).max(20).optional(),
  showBody: z.boolean().optional(),
  showWorkouts: z.boolean().optional(),
  showNutrition: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)

  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id) || id === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user ID' })
  }

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

  const { password, ...userColumns } = getTableColumns(users)

  // Read before the update, and from the DB rather than the session cookie, which can be stale or predate the column.
  const currentRepCap = parsed.data.oneRepMaxRepCap !== undefined ? await repCapFor(id) : undefined

  const user = await db
    .update(users)
    .set({
      name: parsed.data.name,
      email: parsed.data.email,
      age: parsed.data.age,
      sex: parsed.data.sex,
      avatarUrl: parsed.data.avatarUrl !== undefined ? parsed.data.avatarUrl || null : undefined,
      weekStart: parsed.data.weekStart,
      defaultRestSeconds: parsed.data.defaultRestSeconds,
      plateSizes: parsed.data.plateSizes ? normalizePlateSizes(parsed.data.plateSizes).map(String) : undefined,
      oneRepMaxRepCap: parsed.data.oneRepMaxRepCap,
      showBody: parsed.data.showBody,
      showWorkouts: parsed.data.showWorkouts,
      showNutrition: parsed.data.showNutrition
    })
    .where(eq(users.id, id))
    .returning(userColumns)
    .then((r) => r[0]!)

  // Rollups store bestE1rm computed with the old cap, so a cap change invalidates every one of this user's rows.
  if (parsed.data.oneRepMaxRepCap !== undefined && parsed.data.oneRepMaxRepCap !== currentRepCap) {
    await rebuildRollups(id)
  }

  // Update session with new data
  await replaceUserSession(event, { user: toSessionUser(user) })

  return user
})
