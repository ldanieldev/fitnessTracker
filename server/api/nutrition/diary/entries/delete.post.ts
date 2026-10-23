import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { diaryDays, diaryEntries } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import { zId } from '~~/server/utils/validation'

const deleteSchema = z.object({ ids: z.array(zId).min(1).max(200) })

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const ids = [...new Set((await parseBody(event, deleteSchema)).ids)]

  await db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: diaryEntries.id })
      .from(diaryEntries)
      .innerJoin(diaryDays, eq(diaryDays.id, diaryEntries.dayId))
      .where(and(inArray(diaryEntries.id, ids), eq(diaryDays.userId, userId)))
    if (owned.length !== ids.length) throw createError({ statusCode: 404, statusMessage: 'Entry not found' })

    await tx.delete(diaryEntries).where(inArray(diaryEntries.id, ids))
  })

  return { ok: true }
})
