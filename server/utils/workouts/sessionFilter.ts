import { and, eq, gte, lte, sql, type SQL } from 'drizzle-orm'
import { exercisePrefs, exercises, programPhases, programs, workoutEntries, workoutSessions, workoutSets } from '~~/server/db/schema'
import type { SessionFilterQuery } from '~~/server/utils/workouts/input'

export const effectiveCategoryId = sql`coalesce(${exercisePrefs.categoryId}, ${exercises.categoryId})`

export function sessionFilterWhere(userId: number, filter: SessionFilterQuery): SQL {
  const conditions: SQL[] = [eq(workoutSessions.userId, userId)]
  if (filter.from) conditions.push(gte(workoutSessions.performedOn, filter.from))
  if (filter.to) conditions.push(lte(workoutSessions.performedOn, filter.to))

  const categoryIds = [...new Set(filter.categories ?? [])]
  if (categoryIds.length) {
    const list = sql.join(categoryIds.map((id) => sql`${id}`), sql`, `)
    const matched = sql`(
      select count(distinct ${effectiveCategoryId})
      from ${workoutEntries} we
      inner join ${exercises} on ${exercises.id} = we.exercise_id
      left join ${exercisePrefs} on ${exercisePrefs.exerciseId} = ${exercises.id} and ${exercisePrefs.userId} = ${userId}
      where we.session_id = ${workoutSessions.id} and ${effectiveCategoryId} in (${list})
    )`
    conditions.push(filter.match === 'all' ? sql`${matched} = ${categoryIds.length}` : sql`${matched} > 0`)
  }

  if (filter.exerciseId) {
    const bounds: SQL[] = []
    if (filter.minReps !== undefined) bounds.push(sql`ws.reps >= ${filter.minReps}`)
    // Assisted entries store the assist as a positive weight where less is better, so the bound flips.
    if (filter.minWeight !== undefined) {
      bounds.push(sql`(case when we.load_style = 'assisted' then ws.weight <= ${filter.minWeight} else ws.weight >= ${filter.minWeight} end)`)
    }
    const setMatch = bounds.length
      ? sql`and exists (select 1 from ${workoutSets} ws where ws.entry_id = we.id and ${sql.join(bounds, sql` and `)})`
      : sql``
    conditions.push(sql`exists (
      select 1 from ${workoutEntries} we
      where we.session_id = ${workoutSessions.id} and we.exercise_id = ${filter.exerciseId} ${setMatch}
    )`)
  }

  if (filter.programId) {
    conditions.push(sql`${workoutSessions.programPhaseId} in (
      select pp.id from ${programPhases} pp
      inner join ${programs} p on p.id = pp.program_id
      where pp.program_id = ${filter.programId} and p.user_id = ${userId}
    )`)
    // phaseId only narrows a program filter, the same normalisation sessionFilterParams applies on the client.
    if (filter.phaseId) conditions.push(eq(workoutSessions.programPhaseId, filter.phaseId))
  }

  return and(...conditions)!
}
