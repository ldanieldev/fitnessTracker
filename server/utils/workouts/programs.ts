import { and, asc, count, eq, inArray } from 'drizzle-orm'
import type { Program, ProgramPhase, ProgramSummary } from '~~/shared/types/program'
import { programPhases, programs, routines, userProgramEnrollments, workoutTemplates } from '~~/server/db/schema'
import { db, type DbClient } from '~~/server/utils/db'
import { lockLiveEnrollment } from '~~/server/utils/workouts/enrollments'
import type {
  ProgramCreateInput, ProgramPatchInput, ProgramPhaseCreateInput, ProgramPhasePatchInput
} from '~~/server/utils/workouts/input'
import { renumberSiblings, siblingIds } from '~~/server/utils/workouts/sortOrder'

const PROGRAM_NOT_FOUND = { statusCode: 404, statusMessage: 'Program not found' } as const
const PHASE_NOT_FOUND = { statusCode: 404, statusMessage: 'Phase not found' } as const

export async function ownedProgram(userId: number, id: number, client: DbClient = db) {
  const row = await client.select().from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, userId))).then((r) => r[0])
  if (!row) throw createError(PROGRAM_NOT_FOUND)
  return row
}

// Locking the parent program serialises count-then-insert and renumbering across concurrent phase edits.
async function lockOwnedProgram(client: DbClient, userId: number, id: number) {
  const row = await client.select({ id: programs.id }).from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, userId))).for('update').then((r) => r[0])
  if (!row) throw createError(PROGRAM_NOT_FOUND)
}

async function ownedPhase(userId: number, phaseId: number, client: DbClient) {
  const row = await client
    .select({ id: programPhases.id, programId: programPhases.programId })
    .from(programPhases)
    .innerJoin(programs, eq(programs.id, programPhases.programId))
    .where(and(eq(programPhases.id, phaseId), eq(programs.userId, userId)))
    .then((r) => r[0])
  if (!row) throw createError(PHASE_NOT_FOUND)
  return row
}

async function lockPhaseProgram(tx: DbClient, userId: number, phaseId: number) {
  await lockOwnedProgram(tx, userId, (await ownedPhase(userId, phaseId, tx)).programId)
  // Re-read under the lock: a concurrent delete of this phase would otherwise be renumbered back in as a gap.
  return ownedPhase(userId, phaseId, tx)
}

async function assertOwnRoutine(userId: number, routineId: number | null | undefined, client: DbClient) {
  if (routineId == null) return
  // KEY SHARE makes a phase write queue behind a routine delete and see it gone, instead of failing the FK with a 500.
  const row = await client.select({ id: routines.id }).from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId))).for('key share').then((r) => r[0])
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Routine not found' })
}

export async function programPhaseRows(client: DbClient, programId: number) {
  return client
    .select({
      id: programPhases.id,
      name: programPhases.name,
      sortOrder: programPhases.sortOrder,
      weeks: programPhases.weeks,
      deload: programPhases.deload,
      routineId: programPhases.routineId
    })
    .from(programPhases)
    .where(eq(programPhases.programId, programId))
    .orderBy(asc(programPhases.sortOrder), asc(programPhases.id))
}

export async function toProgramPhases(client: DbClient, rows: Awaited<ReturnType<typeof programPhaseRows>>): Promise<ProgramPhase[]> {
  const routineIds = [...new Set(rows.map((row) => row.routineId).filter((id): id is number => id !== null))]
  const routineRows = routineIds.length
    ? await client
        .select({ id: routines.id, name: routines.name, dayCount: count(workoutTemplates.id) })
        .from(routines)
        .leftJoin(workoutTemplates, eq(workoutTemplates.routineId, routines.id))
        .where(inArray(routines.id, routineIds))
        .groupBy(routines.id)
    : []
  return rows.map((row) => {
    const routine = routineRows.find((candidate) => candidate.id === row.routineId)
    return {
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
      weeks: row.weeks,
      deload: row.deload,
      routine: routine ? { id: routine.id, name: routine.name, dayCount: Number(routine.dayCount) } : null
    }
  })
}

export async function listPrograms(userId: number): Promise<ProgramSummary[]> {
  const rows = await db.select({ id: programs.id, name: programs.name }).from(programs).where(eq(programs.userId, userId))
  if (!rows.length) return []
  const phases = await db
    .select({ programId: programPhases.programId, weeks: programPhases.weeks })
    .from(programPhases)
    .where(inArray(programPhases.programId, rows.map((row) => row.id)))
  const live = await db
    .select({ programId: userProgramEnrollments.programId })
    .from(userProgramEnrollments)
    .where(and(eq(userProgramEnrollments.userId, userId), inArray(userProgramEnrollments.status, ['active', 'paused'])))
  return rows
    .map((row) => {
      const own = phases.filter((phase) => phase.programId === row.id)
      return {
        id: row.id,
        name: row.name,
        phaseCount: own.length,
        totalWeeks: own.reduce((sum, phase) => sum + phase.weeks, 0),
        enrolled: live.some((enrollment) => enrollment.programId === row.id)
      }
    })
    .sort((a, b) => Number(b.enrolled) - Number(a.enrolled) || a.name.localeCompare(b.name))
}

export async function loadProgram(userId: number, id: number): Promise<Program> {
  const row = await ownedProgram(userId, id)
  const phases = await toProgramPhases(db, await programPhaseRows(db, id))
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    totalWeeks: phases.reduce((sum, phase) => sum + phase.weeks, 0),
    phases
  }
}

export async function createProgram(userId: number, input: ProgramCreateInput): Promise<Program> {
  const row = await db.insert(programs)
    .values({ userId, name: input.name, description: input.description || null })
    .returning({ id: programs.id }).then((r) => r[0]!)
  return loadProgram(userId, row.id)
}

export async function patchProgram(userId: number, id: number, patch: ProgramPatchInput): Promise<Program> {
  await ownedProgram(userId, id)
  const values: Partial<typeof programs.$inferInsert> = {}
  if (patch.name !== undefined) values.name = patch.name
  if (patch.description !== undefined) values.description = patch.description || null
  if (Object.keys(values).length) await db.update(programs).set(values).where(eq(programs.id, id))
  return loadProgram(userId, id)
}

export async function deleteProgram(userId: number, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    // The cascade rewrites the enrollment and phases, so take the global order first or a concurrent sync deadlocks with it.
    await lockLiveEnrollment(tx, userId)
    await lockOwnedProgram(tx, userId, id)
    await tx.delete(programs).where(eq(programs.id, id))
  })
}

export async function duplicateProgram(userId: number, id: number): Promise<Program> {
  const copyId = await db.transaction(async (tx) => {
    const source = await ownedProgram(userId, id, tx)
    const phases = await programPhaseRows(tx, id)
    const routineIds = [...new Set(phases.flatMap((phase) => (phase.routineId === null ? [] : [phase.routineId])))]
    // Key-share locked so no routine is deleted before the copy references it; one deleted meanwhile is skipped, as its set-null FK would.
    const live = routineIds.length
      ? new Set((await tx.select({ id: routines.id }).from(routines)
          .where(and(inArray(routines.id, routineIds), eq(routines.userId, userId)))
          .orderBy(asc(routines.id)).for('key share')).map((row) => row.id))
      : new Set<number>()
    const copy = await tx.insert(programs)
      .values({ userId, name: `${source.name} (copy)`.slice(0, 255), description: source.description })
      .returning({ id: programs.id }).then((r) => r[0]!)
    if (phases.length) {
      await tx.insert(programPhases).values(phases.map((phase) => ({
        programId: copy.id,
        name: phase.name,
        sortOrder: phase.sortOrder,
        weeks: phase.weeks,
        deload: phase.deload,
        routineId: phase.routineId !== null && live.has(phase.routineId) ? phase.routineId : null
      })))
    }
    return copy.id
  })
  return loadProgram(userId, copyId)
}

const phaseSiblings = (tx: DbClient, programId: number) =>
  siblingIds(tx, programPhases, programPhases.id, programPhases.sortOrder, programPhases.programId, programId)

export async function addProgramPhase(userId: number, programId: number, input: ProgramPhaseCreateInput): Promise<Program> {
  await db.transaction(async (tx) => {
    await lockOwnedProgram(tx, userId, programId)
    await assertOwnRoutine(userId, input.routineId, tx)
    const siblings = await phaseSiblings(tx, programId)
    await tx.insert(programPhases).values({
      programId,
      name: input.name,
      weeks: input.weeks,
      routineId: input.routineId ?? null,
      deload: input.deload ?? false,
      sortOrder: siblings.length
    })
  })
  return loadProgram(userId, programId)
}

export async function patchProgramPhase(userId: number, phaseId: number, patch: ProgramPhasePatchInput): Promise<Program> {
  const phase = await db.transaction(async (tx) => {
    const owned = await lockPhaseProgram(tx, userId, phaseId)
    await assertOwnRoutine(userId, patch.routineId, tx)
    const values: Partial<typeof programPhases.$inferInsert> = {}
    if (patch.name !== undefined) values.name = patch.name
    if (patch.weeks !== undefined) values.weeks = patch.weeks
    if (patch.routineId !== undefined) values.routineId = patch.routineId
    if (patch.deload !== undefined) values.deload = patch.deload
    if (Object.keys(values).length) await tx.update(programPhases).set(values).where(eq(programPhases.id, phaseId))
    if (patch.sortOrder !== undefined) {
      const ids = (await phaseSiblings(tx, owned.programId)).filter((id) => id !== phaseId)
      ids.splice(Math.min(patch.sortOrder, ids.length), 0, phaseId)
      await renumberSiblings(tx, programPhases, programPhases.id, programPhases.sortOrder, ids)
    }
    return owned
  })
  return loadProgram(userId, phase.programId)
}

export async function deleteProgramPhase(userId: number, phaseId: number): Promise<Program> {
  const phase = await db.transaction(async (tx) => {
    const owned = await lockPhaseProgram(tx, userId, phaseId)
    await tx.delete(programPhases).where(eq(programPhases.id, phaseId))
    await renumberSiblings(tx, programPhases, programPhases.id, programPhases.sortOrder, await phaseSiblings(tx, owned.programId))
    return owned
  })
  return loadProgram(userId, phase.programId)
}
