import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { diaryMealTimes, mealContainers } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { ensureDay, parseDiaryDate } from '~~/server/utils/nutrition/day'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

const mealTimePutSchema = z.object({
  containerId: z.number().int(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable()
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const date = parseDiaryDate(getRouterParam(event, 'date'))
  const body = await parseBody(event, mealTimePutSchema)

  const container = await db
    .select({ id: mealContainers.id })
    .from(mealContainers)
    .where(and(eq(mealContainers.id, body.containerId), eq(mealContainers.userId, userId)))
    .then((r) => r[0])
  if (!container) throw createError({ statusCode: 404, statusMessage: 'Container not found' })

  await db.transaction(async (tx) => {
    const day = await ensureDay(tx, userId, date)

    if (body.time === null) {
      await tx
        .delete(diaryMealTimes)
        .where(and(eq(diaryMealTimes.dayId, day.id), eq(diaryMealTimes.containerId, body.containerId)))
      return
    }

    await tx
      .insert(diaryMealTimes)
      .values({ dayId: day.id, containerId: body.containerId, time: body.time })
      .onConflictDoUpdate({
        target: [diaryMealTimes.dayId, diaryMealTimes.containerId],
        set: { time: body.time }
      })
  })

  return { ok: true }
})
