import { z } from 'zod'
import { isoDate } from '~~/server/utils/body/input'
import { buildAccountExport } from '~~/server/utils/export/account'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

const exportQuerySchema = z.object({ today: isoDate.optional() })

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { today } = parseQuery(event, exportQuerySchema)
  const data = await buildAccountExport(userId)
  const date = today ?? data.exportedAt.slice(0, 10)
  setHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="my-fitness-journal-${date}.json"`)
  return data
})
