import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { ProgramImportResult } from '~~/shared/types/program'
import type { TrackingType } from '~~/shared/types/workout'
import { matchImportExercise, type ExportExercise, type ProgramExport } from '~~/shared/utils/programExport'
import { exerciseCategories, exercises, programPhases, programs, routines, workoutTemplateEntries, workoutTemplates } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadProgram } from '~~/server/utils/workouts/programs'
import { loadRoutine } from '~~/server/utils/workouts/routines'
import { createExercise } from '~~/server/utils/workouts/exercises'
import { createCategory, listCategoriesForUser } from '~~/server/utils/workouts/categories'
import { targetColumns } from '~~/server/utils/workouts/targets'
import type { CategoryColor } from '~~/shared/utils/categoryColors'

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'program'
}

export async function exportProgram(userId: number, id: number): Promise<{ filename: string, body: ProgramExport }> {
  const program = await loadProgram(userId, id)
  const routineIds = [...new Set(program.phases.map((phase) => phase.routine?.id).filter((rid): rid is number => rid !== undefined))]
  const loaded = await Promise.all(routineIds.map((rid) => loadRoutine(userId, rid)))
  const exerciseIds = [...new Set(loaded.flatMap((r) => r.days.flatMap((d) => d.entries.map((e) => e.exerciseId))))]
  const rows = exerciseIds.length
    ? await db
        .select({
          id: exercises.id,
          name: exercises.name,
          trackingType: exercises.trackingType,
          loadStyle: exercises.loadStyle,
          barWeight: exercises.barWeight,
          externalId: exercises.externalId,
          createdByUserId: exercises.createdByUserId,
          categoryName: exerciseCategories.name,
          categoryColor: exerciseCategories.color
        })
        .from(exercises)
        .innerJoin(exerciseCategories, eq(exerciseCategories.id, exercises.categoryId))
        .where(inArray(exercises.id, exerciseIds))
    : []
  const toExercise = (exerciseId: number): ExportExercise => {
    const row = rows.find((candidate) => candidate.id === exerciseId)!
    if (row.createdByUserId === null && row.externalId) return { externalId: row.externalId }
    return {
      name: row.name,
      trackingType: row.trackingType,
      loadStyle: row.loadStyle,
      barWeight: row.barWeight === null ? null : Number(row.barWeight),
      category: { name: row.categoryName, color: row.categoryColor as CategoryColor }
    }
  }
  const body: ProgramExport = {
    format: 'mfj-program',
    version: 1,
    program: {
      name: program.name,
      description: program.description,
      phases: program.phases.map((phase) => ({
        name: phase.name,
        weeks: phase.weeks,
        deload: phase.deload,
        routine: phase.routine ? routineIds.indexOf(phase.routine.id) : null
      }))
    },
    routines: loaded.map((routine) => ({
      name: routine.name,
      notes: routine.notes,
      days: routine.days.map((day) => ({
        name: day.name,
        description: day.description,
        floating: day.floating,
        entries: day.entries.map((entry) => ({
          exercise: toExercise(entry.exerciseId),
          targetSets: entry.target?.sets ?? null,
          targetLow: entry.target?.low ?? null,
          targetHigh: entry.target?.high ?? null,
          targetWeight: entry.target?.weight ?? null,
          supersetGroup: entry.supersetGroup,
          optional: entry.optional,
          restSeconds: entry.restSeconds,
          notes: entry.notes
        }))
      }))
    }))
  }
  return { filename: `${slug(program.name)}.program.json`, body }
}

async function resolveExercise(
  userId: number,
  wanted: ExportExercise,
  result: ProgramImportResult['exercises']
): Promise<number> {
  if (wanted.externalId) {
    const hit = await db.select({ id: exercises.id }).from(exercises)
      .where(and(eq(exercises.externalId, wanted.externalId), isNull(exercises.createdByUserId), isNull(exercises.deletedAt)))
      .then((r) => r[0])
    if (hit) {
      result.matched++
      return hit.id
    }
  }
  if (!('name' in wanted)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown catalogue exercise ${wanted.externalId}` })
  }
  const own = await db.select({ id: exercises.id, name: exercises.name, trackingType: exercises.trackingType }).from(exercises)
    .where(and(
      eq(exercises.createdByUserId, userId),
      isNull(exercises.deletedAt),
      sql`lower(${exercises.name}) in (lower(${wanted.name}), lower(${`${wanted.name} (imported)`}))`
    ))
  const decision = matchImportExercise(own as { id: number, name: string, trackingType: TrackingType }[], wanted)
  if (decision.kind === 'match') {
    result.matched++
    return decision.id
  }
  const categories = await listCategoriesForUser(userId, { includeHidden: true })
  const category = categories.find((c) => c.name.toLowerCase() === wanted.category.name.toLowerCase())
    ?? await createCategory(userId, { name: wanted.category.name, color: wanted.category.color })
  const created = await createExercise(userId, {
    name: decision.name,
    categoryId: category.id,
    trackingType: wanted.trackingType,
    loadStyle: wanted.loadStyle,
    barWeight: wanted.barWeight,
    equipment: [],
    primaryMuscles: [],
    secondaryMuscles: []
  })
  result.created.push(decision.name)
  return created.id
}

export async function importProgram(userId: number, data: ProgramExport): Promise<ProgramImportResult> {
  const result: ProgramImportResult['exercises'] = { matched: 0, created: [] }
  const cache = new Map<string, number>()
  const exerciseIds: number[][][] = []
  for (const routine of data.routines) {
    const days: number[][] = []
    for (const day of routine.days) {
      const ids: number[] = []
      for (const entry of day.entries) {
        const key = JSON.stringify(entry.exercise)
        let id = cache.get(key)
        if (id === undefined) {
          id = await resolveExercise(userId, entry.exercise, result)
          cache.set(key, id)
        }
        ids.push(id)
      }
      days.push(ids)
    }
    exerciseIds.push(days)
  }

  const programId = await db.transaction(async (tx) => {
    const routineIds: number[] = []
    for (const [r, routine] of data.routines.entries()) {
      const row = await tx.insert(routines).values({ userId, name: routine.name, notes: routine.notes })
        .returning({ id: routines.id }).then((x) => x[0]!)
      routineIds.push(row.id)
      for (const [d, day] of routine.days.entries()) {
        const dayRow = await tx.insert(workoutTemplates).values({
          userId, routineId: row.id, name: day.name, description: day.description, floating: day.floating, sortOrder: d
        }).returning({ id: workoutTemplates.id }).then((x) => x[0]!)
        if (!day.entries.length) continue
        await tx.insert(workoutTemplateEntries).values(day.entries.map((entry, e) => ({
          templateId: dayRow.id,
          exerciseId: exerciseIds[r]![d]![e]!,
          sortOrder: e,
          ...targetColumns({ sets: entry.targetSets, low: entry.targetLow, high: entry.targetHigh, weight: entry.targetWeight }),
          supersetGroup: entry.supersetGroup,
          optional: entry.optional,
          restSeconds: entry.restSeconds,
          notes: entry.notes
        })))
      }
    }
    const program = await tx.insert(programs).values({ userId, name: data.program.name, description: data.program.description })
      .returning({ id: programs.id }).then((x) => x[0]!)
    if (data.program.phases.length) {
      await tx.insert(programPhases).values(data.program.phases.map((phase, index) => ({
        programId: program.id,
        name: phase.name,
        weeks: phase.weeks,
        deload: phase.deload,
        sortOrder: index,
        routineId: phase.routine === null ? null : routineIds[phase.routine]!
      })))
    }
    return program.id
  })
  return { programId, exercises: result }
}
