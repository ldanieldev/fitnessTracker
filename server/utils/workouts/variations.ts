import { and, eq, inArray, isNull } from 'drizzle-orm'
import { exercises, exerciseVariationGroups, exerciseVariationMembers } from '~~/server/db/schema'
import { db, type DbClient } from '~~/server/utils/db'
import type { VariationCreateInput, VariationPatchInput } from '~~/server/utils/workouts/input'
import { isUniqueViolation } from '~~/server/utils/pgError'
import { loadExerciseRows } from '~~/server/utils/workouts/exercises'

export interface VariationGroup {
  id: number
  name: string
  exerciseIds: number[]
}

const NAME_CONFLICT_ERROR = {
  statusCode: 409,
  statusMessage: 'You already have a variation group with that name'
} as const
const NOT_FOUND_ERROR = { statusCode: 404, statusMessage: 'Variation group not found' } as const

async function assertExercisesVisible(userId: number, exerciseIds: number[]): Promise<void> {
  if (exerciseIds.length === 0) return
  const rows = await loadExerciseRows(userId)
  const ids = new Set(rows.map((r) => r.id))
  for (const id of exerciseIds) {
    if (!ids.has(id)) throw createError({ statusCode: 404, statusMessage: 'Exercise not found' })
  }
}

async function loadOwnGroupOrThrow(userId: number, id: number) {
  const row = await db
    .select()
    .from(exerciseVariationGroups)
    .where(and(eq(exerciseVariationGroups.id, id), eq(exerciseVariationGroups.userId, userId)))
    .then((r) => r[0])
  if (!row) throw createError(NOT_FOUND_ERROR)
  return row
}

// Unique on (user_id, exercise_id) moves it between groups; deduped — Postgres rejects a duplicate upsert target.
async function upsertMembers(tx: DbClient, userId: number, groupId: number, exerciseIds: number[]): Promise<void> {
  const ids = [...new Set(exerciseIds)]
  if (ids.length === 0) return
  await tx
    .insert(exerciseVariationMembers)
    .values(ids.map((exerciseId) => ({ groupId, userId, exerciseId })))
    .onConflictDoUpdate({
      target: [exerciseVariationMembers.userId, exerciseVariationMembers.exerciseId],
      set: { groupId }
    })
}

export async function listVariationGroups(userId: number): Promise<VariationGroup[]> {
  const [groups, members] = await Promise.all([
    db
      .select({ id: exerciseVariationGroups.id, name: exerciseVariationGroups.name })
      .from(exerciseVariationGroups)
      .where(eq(exerciseVariationGroups.userId, userId)),
    db
      .select({ groupId: exerciseVariationMembers.groupId, exerciseId: exerciseVariationMembers.exerciseId })
      .from(exerciseVariationMembers)
      .innerJoin(exercises, eq(exercises.id, exerciseVariationMembers.exerciseId))
      .where(and(eq(exerciseVariationMembers.userId, userId), isNull(exercises.deletedAt)))
      .orderBy(exercises.name)
  ])

  const membersByGroup = new Map<number, number[]>()
  for (const m of members) {
    const list = membersByGroup.get(m.groupId) ?? []
    list.push(m.exerciseId)
    membersByGroup.set(m.groupId, list)
  }

  return groups
    .map((g) => ({ id: g.id, name: g.name, exerciseIds: membersByGroup.get(g.id) ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function loadVariationGroup(userId: number, id: number): Promise<VariationGroup> {
  const group = (await listVariationGroups(userId)).find((g) => g.id === id)
  if (!group) throw createError(NOT_FOUND_ERROR)
  return group
}

export async function createVariationGroup(userId: number, input: VariationCreateInput): Promise<VariationGroup> {
  const ids = [...new Set(input.exerciseIds)]
  await assertExercisesVisible(userId, ids)

  let created: { id: number }
  try {
    created = await db.transaction(async (tx) => {
      const group = await tx
        .insert(exerciseVariationGroups)
        .values({ userId, name: input.name })
        .returning({ id: exerciseVariationGroups.id })
        .then((r) => r[0]!)
      await upsertMembers(tx, userId, group.id, ids)
      return group
    })
  } catch (err) {
    if (isUniqueViolation(err, 'variation_group_user_name')) throw createError(NAME_CONFLICT_ERROR)
    throw err
  }

  return loadVariationGroup(userId, created.id)
}

export async function patchVariationGroup(
  userId: number,
  id: number,
  patch: VariationPatchInput
): Promise<VariationGroup> {
  await loadOwnGroupOrThrow(userId, id)
  const addIds = [...new Set(patch.addExerciseIds ?? [])]
  const removeIds = patch.removeExerciseIds ?? []
  await assertExercisesVisible(userId, addIds)

  try {
    await db.transaction(async (tx) => {
      if (patch.name !== undefined) {
        await tx.update(exerciseVariationGroups).set({ name: patch.name }).where(eq(exerciseVariationGroups.id, id))
      }
      await upsertMembers(tx, userId, id, addIds)
      if (removeIds.length) {
        await tx
          .delete(exerciseVariationMembers)
          .where(
            and(
              eq(exerciseVariationMembers.groupId, id),
              eq(exerciseVariationMembers.userId, userId),
              inArray(exerciseVariationMembers.exerciseId, removeIds)
            )
          )
      }
    })
  } catch (err) {
    if (isUniqueViolation(err, 'variation_group_user_name')) throw createError(NAME_CONFLICT_ERROR)
    throw err
  }

  return loadVariationGroup(userId, id)
}

export async function deleteVariationGroup(userId: number, id: number): Promise<void> {
  await loadOwnGroupOrThrow(userId, id)
  await db.delete(exerciseVariationGroups).where(eq(exerciseVariationGroups.id, id))
}
