import { and, eq, getTableColumns, inArray, isNull, type SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import {
  authProviders,
  dayNotes,
  diaryDays,
  diaryDayTargets,
  diaryEntries,
  diaryEntryNutrients,
  diaryMealTimes,
  equipment,
  exerciseCategories,
  exerciseCategoryPrefs,
  exerciseEquipment,
  exerciseMuscles,
  exercisePrefs,
  exercises,
  exerciseVariationGroups,
  exerciseVariationMembers,
  foodFavorites,
  foodNutrients,
  foods,
  foodServings,
  foodSources,
  foodUsageStats,
  goalProfiles,
  goalProfileTargets,
  mealContainers,
  measurementGoals,
  measurements,
  measurementTypePrefs,
  measurementTypes,
  muscles,
  nutrients,
  programPhases,
  programs,
  recipeIngredients,
  recipes,
  routines,
  savedMealItems,
  savedMeals,
  stepDays,
  stepTargets,
  userProgramEnrollments,
  users,
  userTrackedNutrients,
  workoutEntries,
  workoutExerciseGoals,
  workoutSessions,
  workoutSets,
  workoutTemplateEntries,
  workoutTemplates
} from '~~/server/db/schema'
import { db } from '~~/server/utils/db'

export const EXPORT_FORMAT = 'my-fitness-journal-export'
export const EXPORT_VERSION = 1

type Rows = Record<string, unknown>[]

/** Tables left out of the export on purpose; anything else in the schema must appear in `accountTables`. */
export const EXPORT_EXCLUDED_TABLES = {
  workout_exercise_rollups: 'derived from sessions; rebuilt on demand',
  import_jobs: 'transient job rows holding raw uploaded files',
  search_outbox: 'search index queue, no user data'
} as const

/** Shared catalogue tables; only the rows the user's data points at are exported, under `reference`. */
export const EXPORT_REFERENCE_TABLES = ['nutrients', 'food_sources', 'muscles', 'equipment'] as const

function select(table: PgTable, where: SQL | undefined): Promise<Rows> {
  return db.select().from(table).where(where) as unknown as Promise<Rows>
}

export function accountTables(userId: number) {
  const mySessions = db
    .select({ id: workoutSessions.id })
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, userId))
  const myEntries = db
    .select({ id: workoutEntries.id })
    .from(workoutEntries)
    .where(inArray(workoutEntries.sessionId, mySessions))
  const myDays = db.select({ id: diaryDays.id }).from(diaryDays).where(eq(diaryDays.userId, userId))
  const myDiaryEntries = db
    .select({ id: diaryEntries.id })
    .from(diaryEntries)
    .where(inArray(diaryEntries.dayId, myDays))
  const myFoods = db.select({ id: foods.id }).from(foods).where(eq(foods.createdByUserId, userId))
  const myServings = db.select({ id: foodServings.id }).from(foodServings).where(inArray(foodServings.foodId, myFoods))
  const myExercises = db.select({ id: exercises.id }).from(exercises).where(eq(exercises.createdByUserId, userId))
  const { password: _password, ...userColumns } = getTableColumns(users)

  return {
    users: () => db.select(userColumns).from(users).where(eq(users.id, userId)) as unknown as Promise<Rows>,
    auth_providers: () =>
      db
        .select({
          id: authProviders.id,
          provider: authProviders.provider,
          createdAt: authProviders.createdAt
        })
        .from(authProviders)
        .where(eq(authProviders.userId, userId)) as unknown as Promise<Rows>,
    day_notes: () => select(dayNotes, eq(dayNotes.userId, userId)),
    measurement_types: () => select(measurementTypes, eq(measurementTypes.userId, userId)),
    measurement_type_prefs: () => select(measurementTypePrefs, eq(measurementTypePrefs.userId, userId)),
    measurements: () => select(measurements, eq(measurements.userId, userId)),
    measurement_goals: () => select(measurementGoals, eq(measurementGoals.userId, userId)),
    step_days: () => select(stepDays, eq(stepDays.userId, userId)),
    step_targets: () => select(stepTargets, eq(stepTargets.userId, userId)),
    meal_containers: () => select(mealContainers, eq(mealContainers.userId, userId)),
    goal_profiles: () => select(goalProfiles, eq(goalProfiles.userId, userId)),
    goal_profile_targets: () =>
      select(
        goalProfileTargets,
        inArray(
          goalProfileTargets.profileId,
          db.select({ id: goalProfiles.id }).from(goalProfiles).where(eq(goalProfiles.userId, userId))
        )
      ),
    user_tracked_nutrients: () => select(userTrackedNutrients, eq(userTrackedNutrients.userId, userId)),
    foods: () => select(foods, eq(foods.createdByUserId, userId)),
    food_servings: () => select(foodServings, inArray(foodServings.foodId, myFoods)),
    food_nutrients: () => select(foodNutrients, inArray(foodNutrients.foodServingId, myServings)),
    food_favorites: () => select(foodFavorites, eq(foodFavorites.userId, userId)),
    food_usage_stats: () => select(foodUsageStats, eq(foodUsageStats.userId, userId)),
    recipes: () => select(recipes, eq(recipes.userId, userId)),
    recipe_ingredients: () =>
      select(
        recipeIngredients,
        inArray(
          recipeIngredients.recipeId,
          db.select({ id: recipes.id }).from(recipes).where(eq(recipes.userId, userId))
        )
      ),
    saved_meals: () => select(savedMeals, eq(savedMeals.userId, userId)),
    saved_meal_items: () =>
      select(
        savedMealItems,
        inArray(
          savedMealItems.savedMealId,
          db.select({ id: savedMeals.id }).from(savedMeals).where(eq(savedMeals.userId, userId))
        )
      ),
    diary_days: () => select(diaryDays, eq(diaryDays.userId, userId)),
    diary_day_targets: () => select(diaryDayTargets, inArray(diaryDayTargets.dayId, myDays)),
    diary_meal_times: () => select(diaryMealTimes, inArray(diaryMealTimes.dayId, myDays)),
    diary_entries: () => select(diaryEntries, inArray(diaryEntries.dayId, myDays)),
    diary_entry_nutrients: () => select(diaryEntryNutrients, inArray(diaryEntryNutrients.entryId, myDiaryEntries)),
    exercise_categories: () => select(exerciseCategories, eq(exerciseCategories.userId, userId)),
    exercise_category_prefs: () => select(exerciseCategoryPrefs, eq(exerciseCategoryPrefs.userId, userId)),
    exercises: () => select(exercises, eq(exercises.createdByUserId, userId)),
    exercise_muscles: () => select(exerciseMuscles, inArray(exerciseMuscles.exerciseId, myExercises)),
    exercise_equipment: () => select(exerciseEquipment, inArray(exerciseEquipment.exerciseId, myExercises)),
    exercise_prefs: () => select(exercisePrefs, eq(exercisePrefs.userId, userId)),
    exercise_variation_groups: () => select(exerciseVariationGroups, eq(exerciseVariationGroups.userId, userId)),
    exercise_variation_members: () => select(exerciseVariationMembers, eq(exerciseVariationMembers.userId, userId)),
    workout_exercise_goals: () => select(workoutExerciseGoals, eq(workoutExerciseGoals.userId, userId)),
    routines: () => select(routines, eq(routines.userId, userId)),
    workout_templates: () => select(workoutTemplates, eq(workoutTemplates.userId, userId)),
    workout_template_entries: () =>
      select(
        workoutTemplateEntries,
        inArray(
          workoutTemplateEntries.templateId,
          db.select({ id: workoutTemplates.id }).from(workoutTemplates).where(eq(workoutTemplates.userId, userId))
        )
      ),
    programs: () => select(programs, eq(programs.userId, userId)),
    program_phases: () =>
      select(
        programPhases,
        inArray(
          programPhases.programId,
          db.select({ id: programs.id }).from(programs).where(eq(programs.userId, userId))
        )
      ),
    user_program_enrollments: () => select(userProgramEnrollments, eq(userProgramEnrollments.userId, userId)),
    workout_sessions: () => select(workoutSessions, eq(workoutSessions.userId, userId)),
    workout_entries: () => select(workoutEntries, inArray(workoutEntries.sessionId, mySessions)),
    workout_sets: () => select(workoutSets, inArray(workoutSets.entryId, myEntries))
  }
}

export type AccountTableName = keyof ReturnType<typeof accountTables>

function ids(rows: Rows, key: string): number[] {
  return [...new Set(rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number'))]
}

async function referenceRows(tables: Record<string, Rows>) {
  const exerciseIds = [
    ...new Set([
      ...ids(tables.workout_entries!, 'exerciseId'),
      ...ids(tables.workout_template_entries!, 'exerciseId'),
      ...ids(tables.exercise_prefs!, 'exerciseId'),
      ...ids(tables.exercise_variation_members!, 'exerciseId'),
      ...ids(tables.workout_exercise_goals!, 'exerciseId')
    ])
  ]
  const foodIds = [
    ...new Set([
      ...ids(tables.diary_entries!, 'foodId'),
      ...ids(tables.recipe_ingredients!, 'foodId'),
      ...ids(tables.saved_meal_items!, 'foodId'),
      ...ids(tables.food_favorites!, 'foodId'),
      ...ids(tables.food_usage_stats!, 'foodId')
    ])
  ]
  const sharedExercises = exerciseIds.length
    ? await db
        .select({
          id: exercises.id,
          name: exercises.name,
          categoryId: exercises.categoryId,
          trackingType: exercises.trackingType,
          loadStyle: exercises.loadStyle,
          barWeight: exercises.barWeight
        })
        .from(exercises)
        .where(and(inArray(exercises.id, exerciseIds), isNull(exercises.createdByUserId)))
    : []
  const sharedFoods = foodIds.length
    ? await db
        .select({
          id: foods.id,
          name: foods.name,
          brand: foods.brand,
          sourceId: foods.sourceId
        })
        .from(foods)
        .where(and(inArray(foods.id, foodIds), isNull(foods.createdByUserId)))
    : []
  const sharedFoodServings = sharedFoods.length
    ? await db
        .select({
          id: foodServings.id,
          foodId: foodServings.foodId,
          label: foodServings.label,
          kind: foodServings.kind
        })
        .from(foodServings)
        .where(
          inArray(
            foodServings.foodId,
            sharedFoods.map((f) => f.id)
          )
        )
    : []
  return {
    exercise_categories: await db.select().from(exerciseCategories).where(isNull(exerciseCategories.userId)),
    exercises: sharedExercises,
    foods: sharedFoods,
    food_servings: sharedFoodServings,
    food_sources: await db.select().from(foodSources),
    nutrients: await db.select().from(nutrients),
    muscles: await db.select().from(muscles),
    equipment: await db.select().from(equipment)
  }
}

export async function buildAccountExport(userId: number) {
  const loaders = accountTables(userId)
  const tables: Record<string, Rows> = {}
  for (const [name, load] of Object.entries(loaders)) tables[name] = await load()
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    excluded: EXPORT_EXCLUDED_TABLES,
    tables,
    reference: await referenceRows(tables)
  }
}
