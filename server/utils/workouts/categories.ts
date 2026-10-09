import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import type { CategoryPrefRow, ExerciseCategory } from '~~/shared/types/workout'
import { exerciseCategories, exerciseCategoryPrefs, exercisePrefs, exercises } from '~~/server/db/schema'
import { db, type DbClient } from '~~/server/utils/db'
import type { CategoryCreateInput, CategoryPatchInput } from '~~/server/utils/workouts/input'
import { isUniqueViolation } from '~~/server/utils/pgError'
import { loadCatalogue, type Catalogue } from '~~/server/utils/workouts/catalogue'
import { resolveCategory } from '~~/shared/utils/exerciseResolve'
import { writeSparsePref } from '~~/server/utils/workouts/sparsePrefs'

const NAME_CONFLICT_ERROR = { statusCode: 409, statusMessage: 'You already have a category with that name' } as const
const NOT_FOUND_ERROR = { statusCode: 404, statusMessage: 'Category not found' } as const

async function loadCategoryPrefs(userId: number, client: DbClient): Promise<Map<number, CategoryPrefRow>> {
  const rows = await client.select().from(exerciseCategoryPrefs).where(eq(exerciseCategoryPrefs.userId, userId))
  return new Map(rows.map((r) => [r.categoryId, r]))
}

const CATEGORY_COLUMNS = {
  id: exerciseCategories.id,
  userId: exerciseCategories.userId,
  key: exerciseCategories.key,
  name: exerciseCategories.name,
  color: exerciseCategories.color,
  sortOrder: exerciseCategories.sortOrder
}

function loadOwnCategories(userId: number, client: DbClient) {
  return client
    .select(CATEGORY_COLUMNS)
    .from(exerciseCategories)
    .where(and(isNull(exerciseCategories.deletedAt), eq(exerciseCategories.userId, userId)))
}

// Hidden categories included: a hidden category still owns its exercises.
export async function loadCategoriesByIds(
  userId: number,
  ids: number[],
  client: DbClient = db
): Promise<Map<number, ExerciseCategory>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()
  // Sequential: the client may be a transaction, which must not run two queries at once.
  const rows = await client
    .select(CATEGORY_COLUMNS)
    .from(exerciseCategories)
    .where(and(
      inArray(exerciseCategories.id, unique),
      isNull(exerciseCategories.deletedAt),
      or(isNull(exerciseCategories.userId), eq(exerciseCategories.userId, userId))
    ))
  const prefs = await client
    .select()
    .from(exerciseCategoryPrefs)
    .where(and(eq(exerciseCategoryPrefs.userId, userId), inArray(exerciseCategoryPrefs.categoryId, unique)))
  const prefsById = new Map(prefs.map((pref) => [pref.categoryId, pref]))
  return new Map(rows.map((row) => [row.id, resolveCategory(row, prefsById.get(row.id) ?? null)]))
}

// Callers that already hold the catalogue pass it in: it is a ~900 KB cache read, so a request must not do it twice.
export async function listCategoriesForUser(
  userId: number,
  { includeHidden = false, catalogue, client = db }: { includeHidden?: boolean, catalogue?: Catalogue, client?: DbClient } = {}
): Promise<ExerciseCategory[]> {
  // The two client reads stay sequential (the client may be a transaction); the catalogue read uses its own connection.
  const [shared, [own, prefs]] = await Promise.all([
    catalogue ?? loadCatalogue(),
    loadOwnCategories(userId, client).then(async (own) => [own, await loadCategoryPrefs(userId, client)] as const)
  ])

  return [...shared.categories, ...own]
    .map((row) => resolveCategory(row, prefs.get(row.id) ?? null))
    .filter((c) => includeHidden || !c.hidden)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

export async function listReference(userId: number) {
  const catalogue = await loadCatalogue()
  const categories = await listCategoriesForUser(userId, { catalogue })
  return { categories, muscles: catalogue.muscles, equipment: catalogue.equipment }
}

async function loadResolvedCategory(userId: number, id: number, client: DbClient = db): Promise<ExerciseCategory> {
  const categories = await listCategoriesForUser(userId, { includeHidden: true, client })
  const category = categories.find((c) => c.id === id)
  if (!category) throw createError(NOT_FOUND_ERROR)
  return category
}

function categoryPrefRow(userId: number, categoryId: number) {
  return {
    table: exerciseCategoryPrefs,
    key: { userId, categoryId },
    target: [exerciseCategoryPrefs.userId, exerciseCategoryPrefs.categoryId],
    where: and(eq(exerciseCategoryPrefs.userId, userId), eq(exerciseCategoryPrefs.categoryId, categoryId)),
    empty: and(
      isNull(exerciseCategoryPrefs.name),
      isNull(exerciseCategoryPrefs.color),
      isNull(exerciseCategoryPrefs.sortOrder),
      isNull(exerciseCategoryPrefs.hiddenAt)
    )
  }
}

export async function createCategory(
  userId: number,
  input: CategoryCreateInput,
  client: DbClient = db
): Promise<ExerciseCategory> {
  const existing = await listCategoriesForUser(userId, { client })
  const sortOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1

  let created: { id: number }
  try {
    created = await client
      .insert(exerciseCategories)
      .values({ userId, name: input.name, color: input.color, sortOrder })
      .returning({ id: exerciseCategories.id })
      .then((r) => r[0]!)
  } catch (err) {
    if (isUniqueViolation(err, 'exercise_category_user_name')) throw createError(NAME_CONFLICT_ERROR)
    throw err
  }

  return loadResolvedCategory(userId, created.id, client)
}

export async function patchCategory(userId: number, id: number, patch: CategoryPatchInput): Promise<ExerciseCategory> {
  const row = await db
    .select()
    .from(exerciseCategories)
    .where(and(eq(exerciseCategories.id, id), isNull(exerciseCategories.deletedAt)))
    .then((r) => r[0])
  if (!row || (row.userId !== null && row.userId !== userId)) throw createError(NOT_FOUND_ERROR)

  if (row.userId === null) {
    const prefsPatch: Partial<typeof exerciseCategoryPrefs.$inferInsert> = {}
    if (patch.name !== undefined) prefsPatch.name = patch.name
    if (patch.color !== undefined) prefsPatch.color = patch.color
    if (patch.sortOrder !== undefined) prefsPatch.sortOrder = patch.sortOrder
    if (patch.hidden !== undefined) prefsPatch.hiddenAt = patch.hidden ? new Date() : null
    await db.transaction((tx) => writeSparsePref(tx, categoryPrefRow(userId, id), prefsPatch))
  } else {
    if (patch.hidden !== undefined) {
      throw createError({ statusCode: 400, statusMessage: 'Own categories cannot be hidden; delete them instead' })
    }
    const rowPatch: Partial<typeof exerciseCategories.$inferInsert> = {}
    if (patch.name !== undefined) rowPatch.name = patch.name
    if (patch.color !== undefined) rowPatch.color = patch.color
    if (patch.sortOrder !== undefined) rowPatch.sortOrder = patch.sortOrder
    if (Object.keys(rowPatch).length) {
      try {
        await db.update(exerciseCategories).set(rowPatch).where(eq(exerciseCategories.id, id))
      } catch (err) {
        if (isUniqueViolation(err, 'exercise_category_user_name')) throw createError(NAME_CONFLICT_ERROR)
        throw err
      }
    }
  }

  return loadResolvedCategory(userId, id)
}

// Shared/ownership checked before moveTo, so a shared-category delete still reports 403 without ?moveTo.
export async function deleteCategory(userId: number, id: number, moveTo: number | undefined): Promise<void> {
  const row = await db
    .select()
    .from(exerciseCategories)
    .where(and(eq(exerciseCategories.id, id), isNull(exerciseCategories.deletedAt)))
    .then((r) => r[0])
  if (!row) throw createError(NOT_FOUND_ERROR)
  if (row.userId === null) throw createError({ statusCode: 403, statusMessage: 'Shared categories cannot be deleted' })
  if (row.userId !== userId) throw createError(NOT_FOUND_ERROR)
  if (moveTo === undefined) throw createError({ statusCode: 400, statusMessage: 'moveTo is required' })
  if (moveTo === id) throw createError({ statusCode: 400, statusMessage: 'moveTo must be a different category' })

  const destinations = await listCategoriesForUser(userId, { includeHidden: true })
  if (!destinations.some((c) => c.id === moveTo)) throw createError(NOT_FOUND_ERROR)

  await db.transaction(async (tx) => {
    await tx
      .update(exercisePrefs)
      .set({ categoryId: moveTo })
      .where(and(eq(exercisePrefs.userId, userId), eq(exercisePrefs.categoryId, id)))
    await tx
      .update(exercises)
      .set({ categoryId: moveTo })
      .where(and(eq(exercises.createdByUserId, userId), eq(exercises.categoryId, id)))
    await tx.update(exerciseCategories).set({ deletedAt: new Date() }).where(eq(exerciseCategories.id, id))
  })
}
