import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { diaryDays } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { ensureDay, parseDiaryDate } from '~~/server/utils/nutrition/day'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/nutrition/session'

const notesPutSchema = z.object({ notes: z.string().max(5000).nullable() })

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const date = parseDiaryDate(getRouterParam(event, 'date'))
  const body = await parseBody(event, notesPutSchema)

  await db.transaction(async (tx) => {
    const day = await ensureDay(tx, userId, date)
    await tx.update(diaryDays).set({ notes: body.notes }).where(eq(diaryDays.id, day.id))
  })

  return { ok: true }
})
