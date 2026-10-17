import { eq, sql } from 'drizzle-orm'
import {
  diaryDays,
  exerciseCategories,
  exercises,
  exerciseVariationGroups,
  foods,
  recipes,
  savedMeals,
  searchOutbox,
  users,
  workoutSessions,
  workoutTemplates
} from '../db/schema'
import { db } from './db'

// The users cascade hits foods/recipes before diary rows, whose references to them are NO ACTION; clear those first.
export async function deleteAccount(userId: number): Promise<void> {
  await db.transaction(async (tx) => {
    // The cascade removes the user's own foods and exercises without the outbox rows that drop them from search.
    await tx.execute(sql`insert into ${searchOutbox} (entity, entity_id, op)
      select 'food', id, 'delete' from ${foods} where created_by_user_id = ${userId}
      union all
      select 'exercise', id, 'delete' from ${exercises} where created_by_user_id = ${userId}`)
    await tx.delete(diaryDays).where(eq(diaryDays.userId, userId))
    await tx.delete(recipes).where(eq(recipes.userId, userId))
    await tx.delete(savedMeals).where(eq(savedMeals.userId, userId))
    await tx.delete(exerciseVariationGroups).where(eq(exerciseVariationGroups.userId, userId))
    // workout_entries / workout_template_entries.exercise_id are ON DELETE restrict: sessions and templates go first.
    await tx.delete(workoutSessions).where(eq(workoutSessions.userId, userId))
    await tx.delete(workoutTemplates).where(eq(workoutTemplates.userId, userId))
    // exercises.category_id is ON DELETE restrict: own exercises go before own categories, not by trigger order.
    await tx.delete(exercises).where(eq(exercises.createdByUserId, userId))
    await tx.delete(exerciseCategories).where(eq(exerciseCategories.userId, userId))
    await tx.delete(users).where(eq(users.id, userId))
  })
}
