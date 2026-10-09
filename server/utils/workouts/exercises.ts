import { and, eq, isNull, ne, or } from 'drizzle-orm'
import type {
  CatalogueExerciseRow,
  Exercise,
  ExerciseCategory,
  ExerciseDetail,
  ExerciseListFilters,
  ExercisePrefRow,
  ExerciseRow
} from '~~/shared/types/workout'
import { exercisePrefs, exercises, exerciseVariationMembers } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { listCategoriesForUser, loadCategoriesByIds } from '~~/server/utils/workouts/categories'
import { loadCatalogue, queryExerciseRows } from '~~/server/utils/workouts/catalogue'
import { getExerciseSearchProvider, markExerciseSearchUnhealthy } from '~~/server/utils/workouts/searchProvider'
import { resolveAndFilter, resolveExerciseRow } from '~~/shared/utils/exerciseList'
import { matchesTerms } from '~~/shared/utils/exerciseSearch'

function ownedBy(userId: number) {
  return and(isNull(exercises.deletedAt), eq(exercises.createdByUserId, userId))
}

function visibleTo(userId: number) {
  return and(isNull(exercises.deletedAt), or(isNull(exercises.createdByUserId), eq(exercises.createdByUserId, userId)))
}

export async function loadExerciseRows(userId: number): Promise<CatalogueExerciseRow[]> {
  const [shared, own] = await Promise.all([loadCatalogue(), queryExerciseRows(ownedBy(userId))])
  return [...shared.exercises, ...own]
}

// Same visibility rule as reads: own rows or shared catalogue rows, never another user's private exercise.
export async function loadVisibleExerciseRow(userId: number, exerciseId: number): Promise<ExerciseRow> {
  const [row] = await queryExerciseRows(and(visibleTo(userId), eq(exercises.id, exerciseId)))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
  return row
}
export async function loadPrefs(userId: number): Promise<Map<number, ExercisePrefRow>> {
  const rows = await db.select().from(exercisePrefs).where(eq(exercisePrefs.userId, userId))
  return new Map(rows.map((r) => [r.exerciseId, r]))
}

export async function listExercisesForUser(userId: number, filters: ExerciseListFilters = {}): Promise<Exercise[]> {
  const [catalogue, own, prefs] = await Promise.all([
    loadCatalogue(),
    queryExerciseRows(ownedBy(userId)),
    loadPrefs(userId)
  ])
  const categories = await listCategoriesForUser(userId, { includeHidden: true, catalogue })
  const rows = [...catalogue.exercises, ...own]
  const categoriesById = new Map(categories.map((c) => [c.id, c]))
  const matched = resolveAndFilter(rows, prefs, categoriesById, filters)

  const q = filters.q?.trim() ?? ''
  // A name match that the filters removed is a real empty result, not a typo to rescue.
  const rescue = matched.length === 0 && q !== '' && !rows.some((row) => matchesTerms(row.name, q))
  const found = rescue ? await rescueSearch(userId, q, { rows, prefs, categoriesById, filters }) : matched
  return filters.limit === undefined ? found : found.slice(0, filters.limit)
}

interface RescueContext {
  rows: CatalogueExerciseRow[]
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

async function resolveRow(userId: number, row: ExerciseRow): Promise<Exercise> {
  const pref = await db
    .select()
    .from(exercisePrefs)
    .where(and(eq(exercisePrefs.userId, userId), eq(exercisePrefs.exerciseId, row.id)))
    .then((r) => r[0] ?? null)
  const ids = pref?.categoryId != null ? [row.categoryId, pref.categoryId] : [row.categoryId]
  const categoriesById = await loadCategoriesByIds(userId, ids)
  return resolveExerciseRow(row, pref, categoriesById)
}

export async function loadExerciseSettings(userId: number, exerciseId: number): Promise<Exercise> {
  return resolveRow(userId, await loadVisibleExerciseRow(userId, exerciseId))
}

export async function loadExerciseForUser(userId: number, exerciseId: number): Promise<ExerciseDetail> {
  const row = await loadVisibleExerciseRow(userId, exerciseId)
  const [exercise, variations] = await Promise.all([resolveRow(userId, row), loadVariations(userId, exerciseId)])
  return { ...exercise, instructions: row.instructions, variations }
}
