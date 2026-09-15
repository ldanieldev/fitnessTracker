import { and, eq, ne } from 'drizzle-orm'
import { goalProfiles, goalProfileTargets } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { buildGoalTargetRows, goalProfileSchema } from '~~/server/utils/nutrition/goalInput'
import { nutrientCatalog } from '~~/server/utils/nutrition/nutrientIds'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import { isUniqueViolation } from '~~/server/utils/pgError'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await parseBody(event, goalProfileSchema)

  const existing = await db
    .select({ id: goalProfiles.id })
    .from(goalProfiles)
    .where(and(eq(goalProfiles.id, id), eq(goalProfiles.userId, userId)))
    .then((r) => r[0])
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Goal profile not found' })

  let prepared
  try {
    prepared = buildGoalTargetRows(body, await nutrientCatalog())
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }

  try {
    return await db.transaction(async (tx) => {
      if (body.isDefault) {
        await tx
          .update(goalProfiles)
          .set({ isDefault: false })
          .where(and(eq(goalProfiles.userId, userId), ne(goalProfiles.id, id)))
      }

      const profile = await tx
        .update(goalProfiles)
        .set({
          name: body.name,
          inputMode: body.inputMode,
          calories: body.calories != null ? String(body.calories) : null,
          isDefault: body.isDefault
        })
        .where(eq(goalProfiles.id, id))
        .returning()
        .then((r) => r[0]!)

      await tx.delete(goalProfileTargets).where(eq(goalProfileTargets.profileId, id))

      await tx.insert(goalProfileTargets).values(
        prepared.map((t) => ({
          profileId: profile.id,
          nutrientId: t.nutrientId,
          amount: String(t.amount),
          direction: t.direction,
          ratioPercent: t.ratioPercent === null ? null : String(t.ratioPercent)
        }))
      )

      return { id: profile.id }
    })
  } catch (err) {
    if (isUniqueViolation(err, 'goal_profile_one_default')) {
      throw createError({ statusCode: 409, statusMessage: 'Another default profile was set concurrently' })
    }
    throw err
  }
})
