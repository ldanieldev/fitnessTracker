import { and, count, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm'
import type {
  CatalogueExerciseRow,
  CategoryRow,
  EquipmentRow,
  ExerciseRow,
  MuscleRow
} from '~~/shared/types/workout'
import {
  equipment,
  exerciseCategories,
  exerciseEquipment,
  exerciseMuscles,
  exercises,
  muscles
} from '~~/server/db/schema'
import { db } from '~~/server/utils/db'

export interface Catalogue {
  exercises: CatalogueExerciseRow[]
  categories: CategoryRow[]
  muscles: MuscleRow[]
  equipment: EquipmentRow[]
}

const MAX_AGE = 60 * 60 * 24

// Part of the cache key: the data stamps alone would keep serving a cached old shape until it expires.
const SHAPE_VERSION = 2

export async function queryExerciseRows(where: SQL | undefined): Promise<ExerciseRow[]> {
  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      categoryId: exercises.categoryId,
      trackingType: exercises.trackingType,
      loadStyle: exercises.loadStyle,
      barWeight: exercises.barWeight,
      difficulty: exercises.difficulty,
      images: exercises.images,
      instructions: exercises.instructions,
      createdByUserId: exercises.createdByUserId
    })
    .from(exercises)
    .where(where)
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)

  const muscleRows = await db
    .select({ exerciseId: exerciseMuscles.exerciseId, key: muscles.key, isPrimary: exerciseMuscles.isPrimary })
    .from(exerciseMuscles)
    .innerJoin(muscles, eq(muscles.id, exerciseMuscles.muscleId))
    .where(inArray(exerciseMuscles.exerciseId, ids))

  const equipmentRows = await db
    .select({ exerciseId: exerciseEquipment.exerciseId, key: equipment.key })
    .from(exerciseEquipment)
    .innerJoin(equipment, eq(equipment.id, exerciseEquipment.equipmentId))
    .where(inArray(exerciseEquipment.exerciseId, ids))

  const primaryByExercise = new Map<number, string[]>()
  const secondaryByExercise = new Map<number, string[]>()
  for (const r of muscleRows) {
    const target = r.isPrimary ? primaryByExercise : secondaryByExercise
    const list = target.get(r.exerciseId) ?? []
    list.push(r.key)
    target.set(r.exerciseId, list)
  }

  const equipmentByExercise = new Map<number, string[]>()
  for (const r of equipmentRows) {
    const list = equipmentByExercise.get(r.exerciseId) ?? []
    list.push(r.key)
    equipmentByExercise.set(r.exerciseId, list)
  }

  return rows.map((r) => ({
    ...r,
    instructions: r.instructions ?? [],
    equipment: equipmentByExercise.get(r.id) ?? [],
    primaryMuscles: primaryByExercise.get(r.id) ?? [],
    secondaryMuscles: secondaryByExercise.get(r.id) ?? []
  }))
}

// Instructions are ~590 KB of the ~900 KB payload and only the single-exercise read uses them.
function withoutInstructions({ instructions: _instructions, ...row }: ExerciseRow): CatalogueExerciseRow {
  return row
}

async function loadSharedCatalogue(): Promise<Catalogue> {
  const [exerciseRows, categoryRows, muscleRows, equipmentRows] = await Promise.all([
    queryExerciseRows(and(isNull(exercises.deletedAt), isNull(exercises.createdByUserId))),
    db
      .select({
        id: exerciseCategories.id,
        userId: exerciseCategories.userId,
        key: exerciseCategories.key,
        name: exerciseCategories.name,
        color: exerciseCategories.color,
        sortOrder: exerciseCategories.sortOrder
      })
      .from(exerciseCategories)
      .where(and(isNull(exerciseCategories.deletedAt), isNull(exerciseCategories.userId))),
    db
      .select({
        key: muscles.key,
        name: muscles.name,
        categoryKey: muscles.categoryKey,
        bodyMapGroups: muscles.bodyMapGroups
      })
      .from(muscles)
      .orderBy(muscles.key),
    db.select({ key: equipment.key, name: equipment.name }).from(equipment).orderBy(equipment.key)
  ])
  return {
    exercises: exerciseRows.map(withoutInstructions),
    categories: categoryRows,
    muscles: muscleRows,
    equipment: equipmentRows
  }
}

// Built lazily so importing this file never requires Nitro's defineCachedFunction to exist.
let cachedCatalogue: ((version: string) => Promise<Catalogue>) | undefined

export async function loadCatalogue(): Promise<Catalogue> {
  cachedCatalogue ??= defineCachedFunction((_version: string) => loadSharedCatalogue(), {
    name: 'exercise-catalogue',
    maxAge: MAX_AGE,
    swr: false,
    getKey: (version: string) => version
  })
  // Every shared table in the payload is stamped: the seed restamps all four, so a re-seed always rolls the key.
  const head = await db
    .select({
      rows: count(),
      // Epoch seconds, not a mapped Date: raw subqueries bypass drizzle's mapper and would parse in local time.
      exercises: sql<string | null>`extract(epoch from max(${exercises.updatedAt}))`,
      categories: sql<string | null>`(select extract(epoch from max(updated_at)) from app.exercise_categories
        where user_id is null)`,
      muscles: sql<string | null>`(select extract(epoch from max(updated_at)) from app.muscles)`,
      equipment: sql<string | null>`(select extract(epoch from max(updated_at)) from app.equipment)`
    })
    .from(exercises)
    .where(and(isNull(exercises.createdByUserId), isNull(exercises.deletedAt)))
    .then((r) => r[0])
  const stamps = [head?.exercises, head?.categories, head?.muscles, head?.equipment].map((v) => v ?? '0')
  return cachedCatalogue([SHAPE_VERSION, head?.rows ?? 0, ...stamps].join(':'))
}
