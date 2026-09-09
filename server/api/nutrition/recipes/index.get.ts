import { and, eq, isNull } from 'drizzle-orm'
import { recipes } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const rows = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      servings: recipes.servings,
      servingName: recipes.servingName,
      finishedWeightG: recipes.finishedWeightG,
      notes: recipes.notes
    })
    .from(recipes)
    .where(and(eq(recipes.userId, userId), isNull(recipes.deletedAt)))

  return rows.map((row) => ({
    ...row,
    servings: Number(row.servings),
    finishedWeightG: row.finishedWeightG === null ? null : Number(row.finishedWeightG)
  }))
})
