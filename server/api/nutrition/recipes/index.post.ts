import { db } from '~~/server/utils/db'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { createRecipe, recipeSchema } from '~~/server/utils/nutrition/recipeInput'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, recipeSchema)

  const id = await db.transaction((tx) => createRecipe(tx, userId, body))

  return { id }
})
