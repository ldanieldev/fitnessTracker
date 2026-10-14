import { dayNoteListSchema, listDayNotes } from '~~/server/utils/days/notes'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  return listDayNotes(userId, parseQuery(event, dayNoteListSchema))
})
