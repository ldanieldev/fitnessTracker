import { and, eq } from 'drizzle-orm'
import { diaryDays, diaryEntries } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const entryId = Number(getRouterParam(event, 'id'))

  await db.transaction(async (tx) => {
    const entry = await tx
      .select({ id: diaryEntries.id })
      .from(diaryEntries)
      .innerJoin(diaryDays, eq(diaryDays.id, diaryEntries.dayId))
      .where(and(eq(diaryEntries.id, entryId), eq(diaryDays.userId, userId)))
      .then((r) => r[0])
    if (!entry) throw createError({ statusCode: 404, statusMessage: 'Entry not found' })

    await tx.delete(diaryEntries).where(eq(diaryEntries.id, entry.id))
  })

  return { ok: true }
})
