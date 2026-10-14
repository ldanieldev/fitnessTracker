import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { diaryDays } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { ensureDay, parseDiaryDate } from '~~/server/utils/nutrition/day'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

const incompletePutSchema = z.object({ incomplete: z.boolean() })

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const date = parseDiaryDate(getRouterParam(event, 'date'))
  const { incomplete } = await parseBody(event, incompletePutSchema)

  if (!incomplete) {
    await db
      .update(diaryDays)
      .set({ incomplete: false })
      .where(and(eq(diaryDays.userId, userId), eq(diaryDays.date, date)))
    return { date, incomplete }
  }

  await db.transaction(async (tx) => {
    const day = await ensureDay(tx, userId, date)
    await tx.update(diaryDays).set({ incomplete: true }).where(eq(diaryDays.id, day.id))
  })
  return { date, incomplete }
})
