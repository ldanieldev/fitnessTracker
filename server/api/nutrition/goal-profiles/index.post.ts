import { eq } from 'drizzle-orm'
import { goalProfiles, goalProfileTargets } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { buildGoalTargetRows, goalProfileSchema } from '~~/server/utils/nutrition/goalInput'
import { nutrientCatalog } from '~~/server/utils/nutrition/nutrientIds'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import { changeDate, recordDefaultTargets } from '~~/server/utils/nutrition/targetHistory'
import { isUniqueViolation } from '~~/server/utils/pgError'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const effectiveFrom = changeDate(event)
  const body = await parseBody(event, goalProfileSchema)

  const catalog = await nutrientCatalog()
  let prepared
  try {
    prepared = buildGoalTargetRows(body, catalog)
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }

  try {
    return await db.transaction(async (tx) => {
      if (body.isDefault) {
        await tx.update(goalProfiles).set({ isDefault: false }).where(eq(goalProfiles.userId, userId))
      }

      const profile = await tx
        .insert(goalProfiles)
        .values({
          userId,
          name: body.name,
          inputMode: body.inputMode,
          calories: body.calories != null ? String(body.calories) : null,
          isDefault: body.isDefault
        })
        .returning()
        .then((r) => r[0]!)

      await tx.insert(goalProfileTargets).values(
        prepared.map((t) => ({
          profileId: profile.id,
          nutrientId: t.nutrientId,
          amount: String(t.amount),
          direction: t.direction,
          ratioPercent: t.ratioPercent === null ? null : String(t.ratioPercent)
        }))
      )

      await recordDefaultTargets(tx, userId, effectiveFrom)
      return { id: profile.id }
    })
  } catch (err) {
    if (isUniqueViolation(err, 'goal_profile_one_default')) {
      throw createError({ statusCode: 409, statusMessage: 'Another default profile was set concurrently' })
    }
    throw err
  }
})
