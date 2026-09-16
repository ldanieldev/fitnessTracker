import { measurements } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { toEntry } from '~~/server/utils/body/entries'
import { entryCreateSchema } from '~~/server/utils/body/input'
import { loadTypeForUser } from '~~/server/utils/body/types'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import { todayDate } from '~~/shared/utils/nutritionSummary'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, entryCreateSchema)
  await loadTypeForUser(userId, body.typeId)

  const row = await db
    .insert(measurements)
    .values({
      userId,
      typeId: body.typeId,
      value: String(body.value),
      measuredAt: body.measuredAt ?? new Date(),
      measuredOn: body.measuredOn ?? todayDate()
    })
    .returning()
    .then((r) => r[0]!)

  return toEntry(row)
})
