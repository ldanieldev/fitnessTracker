import { and, desc, eq, inArray, isNotNull, ne, or } from 'drizzle-orm'
import type { Enrollment, PhaseSpan } from '~~/shared/types/program'
import { programPhases, programs, routines, userProgramEnrollments, users } from '~~/server/db/schema'
import { db, type DbClient } from '~~/server/utils/db'
import { logger } from '~~/server/utils/logger'
import { isUniqueViolation } from '~~/server/utils/pgError'
import type { EnrollInput, EnrollmentResumeInput } from '~~/server/utils/workouts/input'
import { ownedProgram, programPhaseRows, toProgramPhases } from '~~/server/utils/workouts/programs'
import { cycleDays, lockUserRoutines } from '~~/server/utils/workouts/routines'
import { anchorFor, programPosition, weekStartOf } from '~~/shared/utils/programs'
import { dueDayId } from '~~/shared/utils/routineCycle'

type EnrollmentRow = typeof userProgramEnrollments.$inferSelect

const LIVE = ['active', 'paused'] as const

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10)
}

const log = logger.child({ component: 'programs' })

function stateError(userId: number, state: EnrollmentRow['status'] | 'none', message: string) {
  log.info({ userId, state }, 'enrollment change refused by its current state')
  return createError({ statusCode: 409, statusMessage: message, data: { code: 'enrollment_state' } })
}

async function userWeekStart(client: DbClient, userId: number): Promise<0 | 1> {
  const row = await client
    .select({ weekStart: users.weekStart })
    .from(users)
    .where(eq(users.id, userId))
    .then((r) => r[0])
  return row?.weekStart === 0 ? 0 : 1
}

export async function liveEnrollment(
  client: DbClient,
  userId: number,
  lock = false
): Promise<EnrollmentRow | undefined> {
  const query = client
    .select()
    .from(userProgramEnrollments)
    .where(and(eq(userProgramEnrollments.userId, userId), inArray(userProgramEnrollments.status, [...LIVE])))
  // FOR NO KEY UPDATE: serialises two syncs, yet leaves a session insert's FK KEY SHARE on enrollment_id unblocked.
  const rows = lock ? await query.for('no key update') : await query
  return rows[0]
}

// Global order per user, as patchRoutine takes it: every routine in id order, then the enrollment row.
export async function lockLiveEnrollment(client: DbClient, userId: number) {
  await lockUserRoutines(client, userId)
  return liveEnrollment(client, userId, true)
}

function positionAt<P extends PhaseSpan>(row: EnrollmentRow, weekStart: 0 | 1, today: string, phases: P[]) {
  return programPosition({ anchorDate: row.anchorDate, anchorWeek: row.anchorWeek, weekStart, today, phases })
}

async function applyPhaseRoutine(client: DbClient, userId: number, routineId: number | null, resetPointer: boolean) {
  const mine = eq(routines.userId, userId)
  const active = await client
    .select({ id: routines.id })
    .from(routines)
    .where(and(mine, eq(routines.active, true)))
  if (routineId === null) {
    if (!active.length) return
    await lockUserRoutines(client, userId)
    await client
      .update(routines)
      .set({ active: false })
      .where(and(mine, eq(routines.active, true)))
    return
  }
  if (!resetPointer && active.length === 1 && active[0]!.id === routineId) return
  await lockUserRoutines(client, userId)
  // routine_one_active is a partial unique index, so the others must go inactive before this one turns on.
  await client
    .update(routines)
    .set({ active: false })
    .where(and(mine, eq(routines.active, true), ne(routines.id, routineId)))
  await client
    .update(routines)
    .set(resetPointer ? { active: true, nextDayId: null } : { active: true })
    .where(and(eq(routines.id, routineId), mine))
}

export async function syncEnrollment(client: DbClient, userId: number, today: string): Promise<void> {
  const row = await lockLiveEnrollment(client, userId)
  if (!row || row.status !== 'active' || today < row.anchorDate) return
  const phases = await programPhaseRows(client, row.programId)
  const position = positionAt(row, await userWeekStart(client, userId), today, phases)
  const where = eq(userProgramEnrollments.id, row.id)
  if (position.state === 'finished') {
    await applyPhaseRoutine(client, userId, null, false)
    await client.update(userProgramEnrollments).set({ status: 'completed', notice: 'complete' }).where(where)
    log.debug({ userId, enrollmentId: row.id }, 'enrollment sync completed the program')
    return
  }
  const phase = position.phase!
  const rollover = phase.id !== row.currentPhaseId
  const previous = phases.find((p) => p.id === row.currentPhaseId)
  const resetPointer = rollover && (!previous || previous.routineId !== phase.routineId)
  await applyPhaseRoutine(client, userId, phase.routineId, resetPointer)
  if (rollover) {
    await client.update(userProgramEnrollments).set({ currentPhaseId: phase.id, notice: 'phase' }).where(where)
    log.debug({ userId, enrollmentId: row.id, phaseId: phase.id }, 'enrollment sync moved to the next phase')
  }
}

export async function pauseLiveEnrollment(client: DbClient, userId: number, today: string): Promise<void> {
  await syncEnrollment(client, userId, today)
  const row = await liveEnrollment(client, userId)
  if (!row || row.status !== 'active') throw stateError(userId, row?.status ?? 'none', 'No program is running')
  const phases = await programPhaseRows(client, row.programId)
  const position = positionAt(row, await userWeekStart(client, userId), today, phases)
  await client
    .update(userProgramEnrollments)
    .set({ status: 'paused', pausedWeek: position.week, notice: null })
    .where(eq(userProgramEnrollments.id, row.id))
  log.info({ userId, enrollmentId: row.id, programId: row.programId, week: position.week }, 'enrollment paused')
}

export async function programControllingRoutine(client: DbClient, userId: number, today: string) {
  await syncEnrollment(client, userId, today)
  const row = await liveEnrollment(client, userId)
  if (!row || row.status !== 'active') return undefined
  const position = positionAt(
    row,
    await userWeekStart(client, userId),
    today,
    await programPhaseRows(client, row.programId)
  )
  return position.state === 'current' ? row : undefined
}

async function nextDayOf(routineId: number) {
  const routine = await db
    .select({ nextDayId: routines.nextDayId })
    .from(routines)
    .where(eq(routines.id, routineId))
    .then((r) => r[0])
  if (!routine) return null
  const days = await cycleDays(routineId)
  const due = days.find((day) => day.id === dueDayId(days, routine.nextDayId))
  return due ? { id: due.id, name: due.name } : null
}

export async function syncAndLoadEnrollment(userId: number, today = utcToday()): Promise<Enrollment | null> {
  await db.transaction((tx) => syncEnrollment(tx, userId, today))
  return loadEnrollment(userId, today)
}

// Read-only: the position is computed for display, while phase rollovers persist only through POST routes.
export async function loadEnrollment(userId: number, today = utcToday()): Promise<Enrollment | null> {
  const row = await db
    .select()
    .from(userProgramEnrollments)
    .where(
      and(
        eq(userProgramEnrollments.userId, userId),
        or(inArray(userProgramEnrollments.status, [...LIVE]), isNotNull(userProgramEnrollments.notice))
      )
    )
    .orderBy(desc(userProgramEnrollments.id))
    .limit(1)
    .then((r) => r[0])
  if (!row) return null

  const program = await db
    .select({ id: programs.id, name: programs.name })
    .from(programs)
    .where(eq(programs.id, row.programId))
    .then((r) => r[0]!)
  const phaseRows = await programPhaseRows(db, row.programId)
  const phases = await toProgramPhases(db, phaseRows)
  const weekStart = await userWeekStart(db, userId)
  // A paused enrollment is frozen at its paused week, so it is positioned as if re-anchored on this week.
  const position =
    row.status === 'paused'
      ? programPosition({
          anchorDate: weekStartOf(today, weekStart),
          anchorWeek: row.pausedWeek ?? row.anchorWeek,
          weekStart,
          today,
          phases: phaseRows
        })
      : positionAt(row, weekStart, today, phaseRows)
  const state = row.status === 'paused' ? 'paused' : row.status === 'completed' ? 'finished' : position.state
  const phase = phases[position.phaseIndex] ?? null

  return {
    id: row.id,
    program,
    status: row.status,
    state,
    week: position.week,
    totalWeeks: position.totalWeeks,
    phaseIndex: position.phaseIndex,
    weekInPhase: position.weekInPhase,
    phase,
    phases,
    anchorDate: row.anchorDate,
    notice: row.notice,
    nextDay: state === 'current' && phase?.routine ? await nextDayOf(phase.routine.id) : null
  }
}

async function existsError(client: DbClient, userId: number, programId: number) {
  log.info({ userId, programId }, 'enroll refused: a program is already running')
  const running = await client
    .select({ id: programs.id, name: programs.name })
    .from(programs)
    .where(eq(programs.id, programId))
    .then((r) => r[0]!)
  return createError({
    statusCode: 409,
    statusMessage: `You're already running ${running.name}`,
    data: { code: 'enrollment_exists', program: running }
  })
}

async function enrollInTransaction(userId: number, programId: number, input: EnrollInput, today: string) {
  return db.transaction(async (tx) => {
    await syncEnrollment(tx, userId, today)
    // Checked after the sync's locks: a program delete that held them first must read as gone, not as phaseless.
    await ownedProgram(userId, programId, tx)
    const phases = await programPhaseRows(tx, programId)
    if (!phases.length)
      throw createError({ statusCode: 400, statusMessage: 'Add a phase before starting this program' })
    const live = await liveEnrollment(tx, userId)
    if (live && !input.replace) throw await existsError(tx, userId, live.programId)
    if (live)
      await tx.update(userProgramEnrollments).set({ status: 'abandoned' }).where(eq(userProgramEnrollments.id, live.id))
    await tx
      .update(userProgramEnrollments)
      .set({ notice: null })
      .where(and(eq(userProgramEnrollments.userId, userId), isNotNull(userProgramEnrollments.notice)))
    const now = input.when === 'now'
    const [created] = await tx
      .insert(userProgramEnrollments)
      .values({
        userId,
        programId,
        status: 'active',
        anchorDate: anchorFor(input.when, today, await userWeekStart(tx, userId)),
        anchorWeek: 1,
        currentPhaseId: now ? phases[0]!.id : null
      })
      .returning({ id: userProgramEnrollments.id })
    if (now) await applyPhaseRoutine(tx, userId, phases[0]!.routineId, true)
    return { enrollmentId: created!.id, replacedEnrollmentId: live?.id ?? null }
  })
}

export async function enrollProgram(userId: number, programId: number, input: EnrollInput): Promise<Enrollment | null> {
  const today = input.today ?? utcToday()
  try {
    const { enrollmentId, replacedEnrollmentId } = await enrollInTransaction(userId, programId, input, today)
    log.info({ userId, programId, enrollmentId, replacedEnrollmentId, when: input.when }, 'enrolled in a program')
  } catch (err) {
    if (!isUniqueViolation(err, 'enrollment_one_live')) throw err
    const live = await liveEnrollment(db, userId)
    if (!live) throw err
    throw await existsError(db, userId, live.programId)
  }
  return loadEnrollment(userId, today)
}

export async function pauseEnrollment(userId: number, today = utcToday()): Promise<Enrollment | null> {
  await db.transaction((tx) => pauseLiveEnrollment(tx, userId, today))
  return loadEnrollment(userId, today)
}

export async function resumeEnrollment(userId: number, input: EnrollmentResumeInput): Promise<Enrollment | null> {
  const today = input.today ?? utcToday()
  const resumed = await db.transaction(async (tx) => {
    const row = await lockLiveEnrollment(tx, userId)
    if (!row || row.status !== 'paused') throw stateError(userId, row?.status ?? 'none', 'No program is paused')
    await tx
      .update(userProgramEnrollments)
      .set({
        status: 'active',
        anchorDate: anchorFor(input.when, today, await userWeekStart(tx, userId)),
        anchorWeek: row.pausedWeek ?? row.anchorWeek,
        pausedWeek: null
      })
      .where(eq(userProgramEnrollments.id, row.id))
    await syncEnrollment(tx, userId, today)
    return row
  })
  log.info({ userId, enrollmentId: resumed.id, programId: resumed.programId, when: input.when }, 'enrollment resumed')
  return loadEnrollment(userId, today)
}

export async function endEnrollment(userId: number, today = utcToday()): Promise<null> {
  const ended = await db.transaction(async (tx) => {
    const before = await liveEnrollment(tx, userId)
    await syncEnrollment(tx, userId, today)
    const row = await liveEnrollment(tx, userId)
    if (!row) {
      if (before) return null
      throw stateError(userId, 'none', 'No program is running')
    }
    await tx
      .update(userProgramEnrollments)
      .set({ status: 'abandoned', notice: null })
      .where(eq(userProgramEnrollments.id, row.id))
    return row
  })
  if (ended) log.info({ userId, enrollmentId: ended.id, programId: ended.programId }, 'enrollment ended')
  return null
}

export async function dismissEnrollmentNotice(userId: number, today = utcToday()): Promise<Enrollment | null> {
  await db.transaction(async (tx) => {
    await lockUserRoutines(tx, userId)
    await tx
      .update(userProgramEnrollments)
      .set({ notice: null })
      .where(and(eq(userProgramEnrollments.userId, userId), isNotNull(userProgramEnrollments.notice)))
  })
  log.debug({ userId }, 'enrollment notice dismissed')
  return loadEnrollment(userId, today)
}

export async function sessionProgramTag(client: DbClient, userId: number, performedOn: string) {
  const row = await liveEnrollment(client, userId)
  if (!row || row.status !== 'active') return null
  const phases = await programPhaseRows(client, row.programId)
  const position = positionAt(row, await userWeekStart(client, userId), performedOn, phases)
  if (position.state !== 'current') return null
  return { enrollmentId: row.id, programPhaseId: position.phase!.id, programWeek: position.week }
}

export async function programsUsingRoutine(client: DbClient, routineId: number) {
  return client
    .selectDistinct({ id: programs.id, name: programs.name })
    .from(programPhases)
    .innerJoin(programs, eq(programs.id, programPhases.programId))
    .where(eq(programPhases.routineId, routineId))
}
