import { isoDate } from '~~/server/utils/body/input'
import { dayNotePutSchema, saveDayNote } from '~~/server/utils/days/notes'
import { parseBody, parseWith } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const date = parseWith(isoDate, getRouterParam(event, 'date'))
  const { note } = await parseBody(event, dayNotePutSchema)
  return { date, note: await saveDayNote(userId, date, note) }
})
