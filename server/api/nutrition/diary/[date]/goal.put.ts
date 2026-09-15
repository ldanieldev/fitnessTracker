import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { diaryDays, goalProfiles } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { ensureDay, parseDiaryDate, snapshotTargets } from '~~/server/utils/nutrition/day'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

const goalPutSchema = z.object({ profileId: z.number().int() })

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const date = parseDiaryDate(getRouterParam(event, 'date'))
  const body = await parseBody(event, goalPutSchema)

  const profile = await db
    .select({ id: goalProfiles.id })
    .from(goalProfiles)
    .where(
      and(
        eq(goalProfiles.id, body.profileId),
        eq(goalProfiles.userId, userId),
        isNull(goalProfiles.deletedAt)
      )
    )
    .then((r) => r[0])
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'Goal profile not found' })

  await db.transaction(async (tx) => {
    const day = await ensureDay(tx, userId, date)
    await snapshotTargets(tx, day.id, profile.id)
    await tx.update(diaryDays).set({ goalProfileId: profile.id }).where(eq(diaryDays.id, day.id))
  })

  return { ok: true }
})
