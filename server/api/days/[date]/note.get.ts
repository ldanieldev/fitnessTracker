import { isoDate } from '~~/server/utils/body/input'
import { loadDayNote } from '~~/server/utils/days/notes'
import { parseWith } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const date = parseWith(isoDate, getRouterParam(event, 'date'))
  return { date, note: await loadDayNote(userId, date) }
})
