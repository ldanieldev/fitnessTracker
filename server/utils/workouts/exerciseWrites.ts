import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { ExerciseDetail, ExerciseRow } from '~~/shared/types/workout'
import {
  equipment,
  exerciseEquipment,
  exerciseMuscles,
  exercisePrefs,
  exercises,
  exerciseVariationMembers,
  muscles
} from '~~/server/db/schema'
import { db, type DbClient, type DbTransaction } from '~~/server/utils/db'
import type { ExerciseCreateInput, ExercisePrefsInput, ExerciseUpdateInput } from '~~/server/utils/workouts/input'
import { isForeignKeyViolation, isUniqueViolation } from '~~/server/utils/pgError'
import { enqueueExerciseOutbox } from '~~/server/utils/workouts/searchOutbox'
import { writeSparsePref } from '~~/server/utils/workouts/sparsePrefs'
import { loadCategoriesByIds } from '~~/server/utils/workouts/categories'
import { loadExerciseForUser, loadVisibleExerciseRow } from '~~/server/utils/workouts/exercises'
import { effectiveLoadStyle } from '~~/shared/utils/exerciseResolve'
import { normalizePlateSizes } from '~~/shared/utils/plates'

const NAME_CONFLICT_ERROR = { statusCode: 409, statusMessage: 'You already have an exercise with that name' } as const
const SHARED_EDIT_ERROR = { statusCode: 403, statusMessage: 'Shared exercises cannot be edited' } as const
const CATEGORY_NOT_FOUND_ERROR = { statusCode: 404, statusMessage: 'Category not found' } as const
const BAD_REFERENCE_ERROR = { statusCode: 400, statusMessage: 'Unknown reference in request' } as const
const FORK_OWN_ERROR = { statusCode: 403, statusMessage: 'Your own exercises can be edited directly' } as const
const PREF_COLUMNS = [
  'categoryId', 'trackingType', 'loadStyle', 'barWeight', 'weightIncrement', 'restSeconds', 'notes', 'link',
  'defaultGraph'
] as const

// Unvalidated it reaches the insert as a raw FK, which 500s on a bogus id and lets another user's category in.
async function assertCategoryVisible(userId: number, categoryId: number, client: DbClient = db): Promise<void> {
  if (!(await loadCategoriesByIds(userId, [categoryId], client)).has(categoryId)) throw createError(CATEGORY_NOT_FOUND_ERROR)
}

function exerciseWriteError(err: unknown): unknown {
  if (isUniqueViolation(err, 'exercise_user_name')) return createError(NAME_CONFLICT_ERROR)
  if (isForeignKeyViolation(err)) return createError(BAD_REFERENCE_ERROR)
  return err
}

async function resolveEquipmentIds(tx: DbClient, keys: string[]): Promise<number[]> {
  const unique = [...new Set(keys)]
  if (unique.length === 0) return []
  const rows = await tx
    .select({ id: equipment.id, key: equipment.key })
    .from(equipment)
    .where(inArray(equipment.key, unique))
  const byKey = new Map(rows.map((r) => [r.key, r.id]))
  return unique.map((key) => {
    const id = byKey.get(key)
    if (id === undefined) throw createError({ statusCode: 400, statusMessage: 'Unknown equipment' })
    return id
  })
}

async function replaceEquipmentJunctions(tx: DbClient, exerciseId: number, keys: string[]): Promise<void> {
  await tx.delete(exerciseEquipment).where(eq(exerciseEquipment.exerciseId, exerciseId))
  const ids = await resolveEquipmentIds(tx, keys)
  if (ids.length) await tx.insert(exerciseEquipment).values(ids.map((equipmentId) => ({ exerciseId, equipmentId })))
}

async function resolveMuscleIds(tx: DbClient, keys: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(keys)]
  if (unique.length === 0) return new Map()
  const rows = await tx.select({ id: muscles.id, key: muscles.key }).from(muscles).where(inArray(muscles.key, unique))
  const byKey = new Map(rows.map((r) => [r.key, r.id]))
  for (const key of unique) if (!byKey.has(key)) throw createError({ statusCode: 400, statusMessage: 'Unknown muscle' })
  return byKey
}

// A muscle listed in both primary and secondary stays primary.
async function replaceMuscleJunctions(
  tx: DbClient,
  exerciseId: number,
  primary: string[],
  secondary: string[]
): Promise<void> {
  await tx.delete(exerciseMuscles).where(eq(exerciseMuscles.exerciseId, exerciseId))
  const secondaryOnly = secondary.filter((key) => !primary.includes(key))
  const byKey = await resolveMuscleIds(tx, [...primary, ...secondaryOnly])
  const rows = [
    ...primary.map((key) => ({ exerciseId, muscleId: byKey.get(key)!, isPrimary: true })),
    ...secondaryOnly.map((key) => ({ exerciseId, muscleId: byKey.get(key)!, isPrimary: false }))
  ]
  if (rows.length) await tx.insert(exerciseMuscles).values(rows)
}

function exercisePrefRow(userId: number, exerciseId: number) {
  return {
    table: exercisePrefs,
    key: { userId, exerciseId },
    target: [exercisePrefs.userId, exercisePrefs.exerciseId],
    where: and(eq(exercisePrefs.userId, userId), eq(exercisePrefs.exerciseId, exerciseId)),
    empty: and(
      ...PREF_COLUMNS.map((col) => isNull(exercisePrefs[col])),
      isNull(exercisePrefs.plateSizes),
      eq(exercisePrefs.favorite, false),
      isNull(exercisePrefs.hiddenAt)
    )
  }
}

function writePrefPatch(
  tx: DbClient,
  userId: number,
  exerciseId: number,
  patch: Partial<typeof exercisePrefs.$inferInsert>
): Promise<void> {
  return writeSparsePref(tx, exercisePrefRow(userId, exerciseId), patch)
}

/** Creates the exercise inside the caller's transaction and returns its id; the row is only readable once that commits. */
export async function insertExercise(tx: DbTransaction, userId: number, input: ExerciseCreateInput): Promise<number> {
  await assertCategoryVisible(userId, input.categoryId, tx)
  const barWeight = input.loadStyle === 'barbell' && input.barWeight != null ? String(input.barWeight) : null
  try {
    const row = await tx
      .insert(exercises)
      .values({
        name: input.name,
        categoryId: input.categoryId,
        trackingType: input.trackingType,
        loadStyle: input.loadStyle ?? null,
        barWeight,
        createdByUserId: userId
      })
      .returning({ id: exercises.id })
      .then((r) => r[0]!)

    await replaceEquipmentJunctions(tx, row.id, input.equipment)
    await replaceMuscleJunctions(tx, row.id, input.primaryMuscles, input.secondaryMuscles)
    if (input.notes !== undefined) await writePrefPatch(tx, userId, row.id, { notes: input.notes })
    await enqueueExerciseOutbox(tx, row.id, 'upsert')
    return row.id
  } catch (err) {
    throw exerciseWriteError(err)
  }
}

export async function createExercise(userId: number, input: ExerciseCreateInput): Promise<ExerciseDetail> {
  const id = await db.transaction((tx) => insertExercise(tx, userId, input))
  return loadExerciseForUser(userId, id)
}

export async function updateExercise(
  userId: number,
  exerciseId: number,
  input: ExerciseUpdateInput
): Promise<ExerciseDetail> {
  const row = await loadVisibleExerciseRow(userId, exerciseId)
  if (row.createdByUserId === null) throw createError(SHARED_EDIT_ERROR)
  if (input.categoryId !== undefined) await assertCategoryVisible(userId, input.categoryId)

  const loadStyle = input.loadStyle !== undefined ? input.loadStyle : row.loadStyle
  const patch: Partial<typeof exercises.$inferInsert> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId
  if (input.trackingType !== undefined) patch.trackingType = input.trackingType
  if (input.loadStyle !== undefined) patch.loadStyle = input.loadStyle ?? null
  if (input.loadStyle !== undefined || input.barWeight !== undefined) {
    const currentBarWeight = row.barWeight != null ? Number(row.barWeight) : null
    const barWeightValue = input.barWeight !== undefined ? input.barWeight : currentBarWeight
    patch.barWeight = loadStyle === 'barbell' && barWeightValue != null ? String(barWeightValue) : null
  }

  try {
    await db.transaction(async (tx) => {
      if (Object.keys(patch).length) await tx.update(exercises).set(patch).where(eq(exercises.id, exerciseId))
      if (input.equipment !== undefined) await replaceEquipmentJunctions(tx, exerciseId, input.equipment)
      if (input.primaryMuscles !== undefined || input.secondaryMuscles !== undefined) {
        await replaceMuscleJunctions(
          tx,
          exerciseId,
          input.primaryMuscles ?? row.primaryMuscles,
          input.secondaryMuscles ?? row.secondaryMuscles
        )
      }
      if (input.notes !== undefined) await writePrefPatch(tx, userId, exerciseId, { notes: input.notes })
      await enqueueExerciseOutbox(tx, exerciseId, 'upsert')
    })
  } catch (err) {
    throw exerciseWriteError(err)
  }

  return loadExerciseForUser(userId, exerciseId)
}

export async function softDeleteExercise(userId: number, exerciseId: number): Promise<void> {
  const row = await loadVisibleExerciseRow(userId, exerciseId)
  if (row.createdByUserId === null) throw createError(SHARED_EDIT_ERROR)

  await db.transaction(async (tx) => {
    await tx.update(exercises).set({ deletedAt: new Date() }).where(eq(exercises.id, exerciseId))
    await tx
      .delete(exerciseVariationMembers)
      .where(and(eq(exerciseVariationMembers.userId, userId), eq(exerciseVariationMembers.exerciseId, exerciseId)))
    await enqueueExerciseOutbox(tx, exerciseId, 'delete')
  })
}

export async function forkExercise(userId: number, exerciseId: number): Promise<ExerciseDetail> {
  const row = await loadVisibleExerciseRow(userId, exerciseId)
  if (row.createdByUserId !== null) throw createError(FORK_OWN_ERROR)

  const forked = await db.transaction(async (tx) => {
    const copy = await tx
      .insert(exercises)
      .values({
        name: row.name,
        categoryId: row.categoryId,
        trackingType: row.trackingType,
        loadStyle: row.loadStyle,
        barWeight: row.barWeight,
        difficulty: row.difficulty,
        instructions: row.instructions,
        images: row.images,
        externalId: null,
        createdByUserId: userId
      })
      .returning({ id: exercises.id })
      .then((r) => r[0]!)

    await replaceEquipmentJunctions(tx, copy.id, row.equipment)
    await replaceMuscleJunctions(tx, copy.id, row.primaryMuscles, row.secondaryMuscles)
    await enqueueExerciseOutbox(tx, copy.id, 'upsert')
    // Fork replaces the original in this user's list — hide it so both copies don't show side by side.
    await writePrefPatch(tx, userId, exerciseId, { hiddenAt: new Date() })
    return copy
  })

  return loadExerciseForUser(userId, forked.id)
}

function toPrefPatch(input: ExercisePrefsInput): Partial<typeof exercisePrefs.$inferInsert> {
  const patch: Partial<typeof exercisePrefs.$inferInsert> = {}
  for (const key of PREF_COLUMNS) {
    const value = input[key]
    if (value === undefined) continue
    const numeric = key === 'barWeight' || key === 'weightIncrement'
    // @ts-expect-error -- key is one of PREF_COLUMNS, value matches the corresponding column type
    patch[key] = numeric && value !== null ? String(value) : value
  }
  if (input.plateSizes !== undefined) {
    patch.plateSizes = input.plateSizes === null ? null : normalizePlateSizes(input.plateSizes).map(String)
  }
  return patch
}

// Checked after the write so a load-style change in the same PUT counts; throwing rolls the patch back.
async function assertPlatesApply(tx: DbClient, userId: number, row: ExerciseRow): Promise<void> {
  const [pref] = await tx
    .select({ trackingType: exercisePrefs.trackingType, loadStyle: exercisePrefs.loadStyle })
    .from(exercisePrefs)
    .where(and(eq(exercisePrefs.userId, userId), eq(exercisePrefs.exerciseId, row.id)))
  if (effectiveLoadStyle(row, pref ?? null) !== 'barbell') {
    throw createError({ statusCode: 400, statusMessage: 'Plates apply to barbell exercises' })
  }
}

export async function setExercisePrefs(
  userId: number,
  exerciseId: number,
  input: ExercisePrefsInput
): Promise<ExerciseDetail> {
  const row = await loadVisibleExerciseRow(userId, exerciseId)
  if (input.categoryId != null) await assertCategoryVisible(userId, input.categoryId)
  await db.transaction(async (tx) => {
    await writePrefPatch(tx, userId, exerciseId, toPrefPatch(input))
    if (input.plateSizes) await assertPlatesApply(tx, userId, row)
  })
  return loadExerciseForUser(userId, exerciseId)
}

export async function setFavorite(userId: number, exerciseId: number, on: boolean): Promise<ExerciseDetail> {
  await loadVisibleExerciseRow(userId, exerciseId)
  await db.transaction((tx) => writePrefPatch(tx, userId, exerciseId, { favorite: on }))
  return loadExerciseForUser(userId, exerciseId)
}

export async function setHidden(userId: number, exerciseId: number, on: boolean): Promise<ExerciseDetail> {
  await loadVisibleExerciseRow(userId, exerciseId)
  await db.transaction((tx) => writePrefPatch(tx, userId, exerciseId, { hiddenAt: on ? new Date() : null }))
  return loadExerciseForUser(userId, exerciseId)
}
