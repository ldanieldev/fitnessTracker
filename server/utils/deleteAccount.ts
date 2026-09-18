import { eq } from 'drizzle-orm'
import {
  diaryDays,
  exerciseCategories,
  exercises,
  exerciseVariationGroups,
  recipes,
  savedMeals,
  users
} from '~~/server/db/schema'
import { db } from '~~/server/utils/db'

// The users cascade reaches foods/recipes before diary rows, and entry/item references back to them are NO ACTION, so clear those owners first.
export async function deleteAccount(userId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(diaryDays).where(eq(diaryDays.userId, userId))
    await tx.delete(recipes).where(eq(recipes.userId, userId))
    await tx.delete(savedMeals).where(eq(savedMeals.userId, userId))
    await tx.delete(exerciseVariationGroups).where(eq(exerciseVariationGroups.userId, userId))
    // exercises.category_id is ON DELETE restrict: own exercises go before own categories, not by trigger order.
    await tx.delete(exercises).where(eq(exercises.createdByUserId, userId))
    await tx.delete(exerciseCategories).where(eq(exerciseCategories.userId, userId))
    await tx.delete(users).where(eq(users.id, userId))
  })
}
