import { z } from 'zod'
import { db } from '~~/server/utils/db'
import { flattenContainerEntries, loadContainerEntriesForUser } from '~~/server/utils/nutrition/fromDiary'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { createSavedMeal } from '~~/server/utils/nutrition/savedMealInput'
import { requireUserId } from '~~/server/utils/nutrition/session'

const fromDiarySchema = z.object({
  date: z.string(),
  containerId: z.number().int(),
  name: z.string().min(1).max(255)
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, fromDiarySchema)

  const entries = await loadContainerEntriesForUser(userId, body.date, body.containerId)
  const { items, skippedQuickAdds, flattenedRecipes } = flattenContainerEntries(entries)
  if (items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to save' })
  }

  const id = await db.transaction((tx) => createSavedMeal(tx, userId, { name: body.name, items }))

  return { id, skippedQuickAdds, flattenedRecipes }
})
