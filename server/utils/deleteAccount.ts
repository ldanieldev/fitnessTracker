import { eq } from 'drizzle-orm'
import { diaryDays, recipes, savedMeals, users } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'

// The users cascade reaches foods/recipes before diary rows, and entry/item references back to them are NO ACTION, so clear those owners first.
export async function deleteAccount(userId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(diaryDays).where(eq(diaryDays.userId, userId))
    await tx.delete(recipes).where(eq(recipes.userId, userId))
    await tx.delete(savedMeals).where(eq(savedMeals.userId, userId))
    await tx.delete(users).where(eq(users.id, userId))
  })
}
