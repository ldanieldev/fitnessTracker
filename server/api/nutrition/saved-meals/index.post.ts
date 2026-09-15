import { db } from '~~/server/utils/db'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { createSavedMeal, savedMealSchema } from '~~/server/utils/nutrition/savedMealInput'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, savedMealSchema)

  const id = await db.transaction((tx) => createSavedMeal(tx, userId, body))

  return { id }
})
