import { and, eq, inArray, isNull, ne } from 'drizzle-orm'
import type {
  Exercise,
  ExerciseCategory,
  ExerciseDetail,
  ExerciseListFilters,
  ExercisePrefRow,
  ExerciseRow
} from '~~/shared/types/workout'
import {
  equipment,
  exerciseEquipment,
  exerciseMuscles,
  exercisePrefs,
  exercises,
  exerciseVariationMembers,
  muscles
} from '~~/server/db/schema'
import { db, type DbClient } from '~~/server/utils/db'
import type { ExerciseCreateInput, ExercisePrefsInput, ExerciseUpdateInput } from '~~/server/utils/workouts/input'
import { isForeignKeyViolation, isUniqueViolation } from '~~/server/utils/pgError'
import { enqueueExerciseOutbox } from '~~/server/utils/workouts/searchOutbox'
import { listCategoriesForUser } from '~~/server/utils/workouts/categories'
import { loadCatalogue, queryExerciseRows, type Catalogue } from '~~/server/utils/workouts/catalogue'
import { getExerciseSearchProvider, markExerciseSearchUnhealthy } from '~~/server/utils/workouts/searchProvider'
import { resolveAndFilter } from '~~/shared/utils/exerciseList'
import { normalizePlateSizes } from '~~/shared/utils/plates'

function ownedBy(userId: number) {
  return and(isNull(exercises.deletedAt), eq(exercises.createdByUserId, userId))
}

const NAME_CONFLICT_ERROR = { statusCode: 409, statusMessage: 'You already have an exercise with that name' } as const
const SHARED_EDIT_ERROR = { statusCode: 403, statusMessage: 'Shared exercises cannot be edited' } as const
const CATEGORY_NOT_FOUND_ERROR = { statusCode: 404, statusMessage: 'Category not found' } as const
const BAD_REFERENCE_ERROR = { statusCode: 400, statusMessage: 'Unknown reference in request' } as const
const PREF_COLUMNS = [
  'categoryId', 'trackingType', 'loadStyle', 'barWeight', 'weightIncrement', 'restSeconds', 'notes', 'link'
] as const

export async function loadExerciseRows(userId: number, catalogue?: Catalogue): Promise<ExerciseRow[]> {
  const [shared, own] = await Promise.all([catalogue ?? loadCatalogue(), queryExerciseRows(ownedBy(userId))])
  return [...shared.exercises, ...own]
}

async function loadExerciseRow(
  userId: number,
  exerciseId: number,
  catalogue: Catalogue
): Promise<ExerciseRow | undefined> {
  const own = await queryExerciseRows(and(ownedBy(userId), eq(exercises.id, exerciseId)))
  return own[0] ?? catalogue.exercises.find((row) => row.id === exerciseId)
}

// Same visibility rule as reads: own rows or shared catalogue rows, never another user's private exercise.
async function loadRowOrThrow(userId: number, exerciseId: number, catalogue: Catalogue): Promise<ExerciseRow> {
  const row = await loadExerciseRow(userId, exerciseId, catalogue)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
  return row
}

// Unvalidated it reaches the insert as a raw FK, which 500s on a bogus id and lets another user's category in.
async function assertCategoryVisible(userId: number, categoryId: number, catalogue: Catalogue): Promise<void> {
  const categories = await listCategoriesForUser(userId, { includeHidden: true, catalogue })
  if (!categories.some((c) => c.id === categoryId)) throw createError(CATEGORY_NOT_FOUND_ERROR)
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

async function cleanupPrefRowIfEmpty(tx: DbClient, userId: number, exerciseId: number): Promise<void> {
  const row = await tx
    .select()
    .from(exercisePrefs)
    .where(and(eq(exercisePrefs.userId, userId), eq(exercisePrefs.exerciseId, exerciseId)))
    .then((r) => r[0])
  if (!row) return
  const allNull = PREF_COLUMNS.every((col) => row[col] == null) && row.plateSizes == null
  if (allNull && !row.favorite && row.hiddenAt == null) {
    const where = and(eq(exercisePrefs.userId, userId), eq(exercisePrefs.exerciseId, exerciseId))
    await tx.delete(exercisePrefs).where(where)
  }
}

async function writePrefPatch(
  tx: DbClient,
  userId: number,
  exerciseId: number,
  patch: Partial<typeof exercisePrefs.$inferInsert>
): Promise<void> {
  if (Object.keys(patch).length === 0) return
  await tx
    .insert(exercisePrefs)
    .values({ userId, exerciseId, ...patch })
    .onConflictDoUpdate({ target: [exercisePrefs.userId, exercisePrefs.exerciseId], set: patch })
  await cleanupPrefRowIfEmpty(tx, userId, exerciseId)
}

export async function loadPrefs(userId: number): Promise<Map<number, ExercisePrefRow>> {
  const rows = await db.select().from(exercisePrefs).where(eq(exercisePrefs.userId, userId))
  return new Map(rows.map((r) => [r.exerciseId, r]))
}

export async function listExercisesForUser(userId: number, filters: ExerciseListFilters = {}): Promise<Exercise[]> {
  const catalogue = await loadCatalogue()
  const [rows, prefs, categories] = await Promise.all([
    loadExerciseRows(userId, catalogue),
    loadPrefs(userId),
    listCategoriesForUser(userId, { includeHidden: true, catalogue })
  ])
  const categoriesById = new Map(categories.map((c) => [c.id, c]))
  const matched = resolveAndFilter(rows, prefs, categoriesById, filters)

  const q = filters.q?.trim() ?? ''
  const found = matched.length > 0 || q === ''
    ? matched
    : await rescueSearch(userId, q, { rows, prefs, categoriesById, filters })
  return filters.limit === undefined ? found : found.slice(0, filters.limit)
}

interface RescueContext {
  rows: ExerciseRow[]
  prefs: Map<number, ExercisePrefRow>
  categoriesById: Map<number, ExerciseCategory>
  filters: ExerciseListFilters
}

// Meilisearch only rescues a query the in-memory matcher could not satisfy; it never reorders a non-empty result.
async function rescueSearch(userId: number, q: string, ctx: RescueContext): Promise<Exercise[]> {
  let candidates
  try {
    candidates = await (await getExerciseSearchProvider()).query(userId, q, 50)
  } catch {
    markExerciseSearchUnhealthy()
    return []
  }
  if (candidates.length === 0) return []

  const relevance = new Map(candidates.map((c) => [c.id, c.relevance]))
  const byId = new Map(ctx.rows.map((row) => [row.id, row]))
  const hits = candidates.map((c) => byId.get(c.id)).filter((row) => row !== undefined)
  const resolved = resolveAndFilter(hits, ctx.prefs, ctx.categoriesById, { ...ctx.filters, q: undefined })
  return resolved.sort(
    (a, b) =>
      Number(b.favorite) - Number(a.favorite) ||
      (relevance.get(b.id) ?? 0) - (relevance.get(a.id) ?? 0) ||
      a.name.localeCompare(b.name)
  )
}

async function loadVariations(userId: number, exerciseId: number): Promise<{ id: number, name: string }[]> {
  const membership = await db
    .select({ groupId: exerciseVariationMembers.groupId })
    .from(exerciseVariationMembers)
    .where(and(eq(exerciseVariationMembers.userId, userId), eq(exerciseVariationMembers.exerciseId, exerciseId)))
    .then((r) => r[0])
  if (!membership) return []

  return db
    .select({ id: exercises.id, name: exercises.name })
    .from(exerciseVariationMembers)
    .innerJoin(exercises, eq(exercises.id, exerciseVariationMembers.exerciseId))
    .where(
      and(
        eq(exerciseVariationMembers.groupId, membership.groupId),
        eq(exerciseVariationMembers.userId, userId),
        ne(exerciseVariationMembers.exerciseId, exerciseId),
        isNull(exercises.deletedAt)
      )
    )
    .orderBy(exercises.name)
}

export async function loadExerciseForUser(
  userId: number,
  exerciseId: number,
  cached?: Catalogue
): Promise<ExerciseDetail> {
  const catalogue = cached ?? (await loadCatalogue())
  const [row, prefs, categories] = await Promise.all([
    loadExerciseRow(userId, exerciseId, catalogue),
    loadPrefs(userId),
    listCategoriesForUser(userId, { includeHidden: true, catalogue })
  ])
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })

  const categoriesById = new Map(categories.map((c) => [c.id, c]))
  const [exercise] = resolveAndFilter([row], prefs, categoriesById, { includeHidden: true })
  const variations = await loadVariations(userId, exerciseId)
  return { ...exercise!, instructions: row.instructions, variations }
}

export async function createExercise(userId: number, input: ExerciseCreateInput): Promise<ExerciseDetail> {
  const catalogue = await loadCatalogue()
  await assertCategoryVisible(userId, input.categoryId, catalogue)
  const barWeight = input.loadStyle === 'barbell' && input.barWeight != null ? String(input.barWeight) : null

  let created: { id: number }
  try {
    created = await db.transaction(async (tx) => {
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
      return row
    })
  } catch (err) {
    if (isUniqueViolation(err, 'exercise_user_name')) throw createError(NAME_CONFLICT_ERROR)
    if (isForeignKeyViolation(err)) throw createError(BAD_REFERENCE_ERROR)
    throw err
  }

  return loadExerciseForUser(userId, created.id, catalogue)
}

export async function updateExercise(
  userId: number,
  exerciseId: number,
  input: ExerciseUpdateInput
): Promise<ExerciseDetail> {
  const catalogue = await loadCatalogue()
  const row = await loadRowOrThrow(userId, exerciseId, catalogue)
  if (row.createdByUserId === null) throw createError(SHARED_EDIT_ERROR)
  if (input.categoryId !== undefined) await assertCategoryVisible(userId, input.categoryId, catalogue)

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
    if (isUniqueViolation(err, 'exercise_user_name')) throw createError(NAME_CONFLICT_ERROR)
    if (isForeignKeyViolation(err)) throw createError(BAD_REFERENCE_ERROR)
    throw err
  }

  return loadExerciseForUser(userId, exerciseId, catalogue)
}

export async function softDeleteExercise(userId: number, exerciseId: number): Promise<void> {
  const catalogue = await loadCatalogue()
  const row = await loadRowOrThrow(userId, exerciseId, catalogue)
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
  const catalogue = await loadCatalogue()
  const row = await loadRowOrThrow(userId, exerciseId, catalogue)
  if (row.createdByUserId !== null) {
    throw createError({ statusCode: 403, statusMessage: 'Only shared exercises can be forked' })
  }

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

  return loadExerciseForUser(userId, forked.id, catalogue)
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

export async function setExercisePrefs(
  userId: number,
  exerciseId: number,
  input: ExercisePrefsInput
): Promise<ExerciseDetail> {
  const catalogue = await loadCatalogue()
  await loadRowOrThrow(userId, exerciseId, catalogue)
  await db.transaction((tx) => writePrefPatch(tx, userId, exerciseId, toPrefPatch(input)))
  return loadExerciseForUser(userId, exerciseId, catalogue)
}

export async function setFavorite(userId: number, exerciseId: number, on: boolean): Promise<ExerciseDetail> {
  const catalogue = await loadCatalogue()
  await loadRowOrThrow(userId, exerciseId, catalogue)
  await db.transaction((tx) => writePrefPatch(tx, userId, exerciseId, { favorite: on }))
  return loadExerciseForUser(userId, exerciseId, catalogue)
}

export async function setHidden(userId: number, exerciseId: number, on: boolean): Promise<ExerciseDetail> {
  const catalogue = await loadCatalogue()
  await loadRowOrThrow(userId, exerciseId, catalogue)
  await db.transaction((tx) => writePrefPatch(tx, userId, exerciseId, { hiddenAt: on ? new Date() : null }))
  return loadExerciseForUser(userId, exerciseId, catalogue)
}
