import { eq } from 'drizzle-orm'
import {
  diaryDays,
  exerciseCategories,
  exercises,
  exerciseVariationGroups,
  recipes,
  savedMeals,
  users,
  workoutSessions
} from '~~/server/db/schema'
import { db } from '~~/server/utils/db'

// The users cascade hits foods/recipes before diary rows, whose references to them are NO ACTION; clear those first.
export async function deleteAccount(userId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(diaryDays).where(eq(diaryDays.userId, userId))
    await tx.delete(recipes).where(eq(recipes.userId, userId))
    await tx.delete(savedMeals).where(eq(savedMeals.userId, userId))
    await tx.delete(exerciseVariationGroups).where(eq(exerciseVariationGroups.userId, userId))
    // workout_entries.exercise_id is ON DELETE restrict: delete own sessions (and entries) before own exercises.
    await tx.delete(workoutSessions).where(eq(workoutSessions.userId, userId))
    // exercises.category_id is ON DELETE restrict: own exercises go before own categories, not by trigger order.
    await tx.delete(exercises).where(eq(exercises.createdByUserId, userId))
    await tx.delete(exerciseCategories).where(eq(exerciseCategories.userId, userId))
    await tx.delete(users).where(eq(users.id, userId))
  })
}
