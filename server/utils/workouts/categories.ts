import { and, eq, isNull } from 'drizzle-orm'
import type { CategoryPrefRow, ExerciseCategory } from '~~/shared/types/workout'
import { exerciseCategories, exerciseCategoryPrefs, exercisePrefs, exercises } from '~~/server/db/schema'
import { db, type DbClient } from '~~/server/utils/db'
import type { CategoryCreateInput, CategoryPatchInput } from '~~/server/utils/workouts/input'
import { isUniqueViolation } from '~~/server/utils/pgError'
import { loadCatalogue, type Catalogue } from '~~/server/utils/workouts/catalogue'
import { resolveCategory } from '~~/shared/utils/exerciseResolve'

const NAME_CONFLICT_ERROR = { statusCode: 409, statusMessage: 'You already have a category with that name' } as const
const NOT_FOUND_ERROR = { statusCode: 404, statusMessage: 'Category not found' } as const

async function loadCategoryPrefs(userId: number): Promise<Map<number, CategoryPrefRow>> {
  const rows = await db.select().from(exerciseCategoryPrefs).where(eq(exerciseCategoryPrefs.userId, userId))
  return new Map(rows.map((r) => [r.categoryId, r]))
}

function loadOwnCategories(userId: number) {
  return db
    .select({
      id: exerciseCategories.id,
      userId: exerciseCategories.userId,
      key: exerciseCategories.key,
      name: exerciseCategories.name,
      color: exerciseCategories.color,
      sortOrder: exerciseCategories.sortOrder
    })
    .from(exerciseCategories)
    .where(and(isNull(exerciseCategories.deletedAt), eq(exerciseCategories.userId, userId)))
}

// Callers that already hold the catalogue pass it in: it is a ~900 KB cache read, so a request must not do it twice.
export async function listCategoriesForUser(
  userId: number,
  { includeHidden = false, catalogue }: { includeHidden?: boolean, catalogue?: Catalogue } = {}
): Promise<ExerciseCategory[]> {
  const [shared, own, prefs] = await Promise.all([
    catalogue ?? loadCatalogue(),
    loadOwnCategories(userId),
    loadCategoryPrefs(userId)
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

async function loadResolvedCategory(userId: number, id: number): Promise<ExerciseCategory> {
  const categories = await listCategoriesForUser(userId, { includeHidden: true })
  const category = categories.find((c) => c.id === id)
  if (!category) throw createError(NOT_FOUND_ERROR)
  return category
}

async function cleanupCategoryPrefIfEmpty(tx: DbClient, userId: number, categoryId: number): Promise<void> {
  const where = and(eq(exerciseCategoryPrefs.userId, userId), eq(exerciseCategoryPrefs.categoryId, categoryId))
  const row = await tx.select().from(exerciseCategoryPrefs).where(where).then((r) => r[0])
  if (!row) return
  if (row.name == null && row.color == null && row.sortOrder == null && row.hiddenAt == null) {
    await tx.delete(exerciseCategoryPrefs).where(where)
  }
}

async function writeCategoryPrefPatch(
  tx: DbClient,
  userId: number,
  categoryId: number,
  patch: Partial<typeof exerciseCategoryPrefs.$inferInsert>
): Promise<void> {
  if (Object.keys(patch).length === 0) return
  await tx
    .insert(exerciseCategoryPrefs)
    .values({ userId, categoryId, ...patch })
    .onConflictDoUpdate({ target: [exerciseCategoryPrefs.userId, exerciseCategoryPrefs.categoryId], set: patch })
  await cleanupCategoryPrefIfEmpty(tx, userId, categoryId)
}

export async function createCategory(userId: number, input: CategoryCreateInput): Promise<ExerciseCategory> {
  const existing = await listCategoriesForUser(userId)
  const sortOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1

  let created: { id: number }
  try {
    created = await db
      .insert(exerciseCategories)
      .values({ userId, name: input.name, color: input.color, sortOrder })
      .returning({ id: exerciseCategories.id })
      .then((r) => r[0]!)
  } catch (err) {
    if (isUniqueViolation(err, 'exercise_category_user_name')) throw createError(NAME_CONFLICT_ERROR)
    throw err
  }

  return loadResolvedCategory(userId, created.id)
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
    await db.transaction((tx) => writeCategoryPrefPatch(tx, userId, id, prefsPatch))
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
