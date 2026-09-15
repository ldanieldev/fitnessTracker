import { and, eq } from 'drizzle-orm'
import { diaryDays, diaryDayTargets, goalProfileTargets } from '~~/server/db/schema'
import type { DbClient } from '../db'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function parseDiaryDate(raw: string | undefined): string {
  if (!raw || !ISO_DATE.test(raw)) {
    throw createError({ statusCode: 400, statusMessage: 'Date must be YYYY-MM-DD' })
  }
  const parsed = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw createError({ statusCode: 400, statusMessage: 'Date must be a real calendar date' })
  }
  return raw
}

export async function snapshotTargets(tx: DbClient, dayId: number, profileId: number) {
  const targets = await tx
    .select()
    .from(goalProfileTargets)
    .where(eq(goalProfileTargets.profileId, profileId))

  await tx.delete(diaryDayTargets).where(eq(diaryDayTargets.dayId, dayId))
  if (targets.length) {
    await tx.insert(diaryDayTargets).values(
      targets.map((t) => ({
        dayId,
        nutrientId: t.nutrientId,
        amount: t.amount,
        direction: t.direction
      }))
    )
  }
}

/**
 * Two tabs logging to the same new date race here; the unique (user_id, date) index plus
 * onConflictDoNothing makes the loser fall through to the select rather than fail.
 */
// goalProfileId stays null here — a day with no profile applied follows the current default at read time (resolveDayTargets).
export async function ensureDay(tx: DbClient, userId: number, date: string) {
  const existing = await tx
    .select({ id: diaryDays.id })
    .from(diaryDays)
    .where(and(eq(diaryDays.userId, userId), eq(diaryDays.date, date)))
    .limit(1)
    .then((r) => r[0])

  if (existing) return existing

  const inserted = await tx
    .insert(diaryDays)
    .values({ userId, date, goalProfileId: null })
    .onConflictDoNothing()
    .returning({ id: diaryDays.id })
    .then((r) => r[0])

  if (inserted) return inserted

  return tx
    .select({ id: diaryDays.id })
    .from(diaryDays)
    .where(and(eq(diaryDays.userId, userId), eq(diaryDays.date, date)))
    .limit(1)
    .then((r) => r[0]!)
}

/** Picks which target set a day shows: an explicitly applied profile keeps its snapshot; otherwise it follows the current default. */
export function resolveDayTargets<T>(goalProfileId: number | null, snapshotTargets: T, defaultProfileTargets: T): T {
  return goalProfileId !== null ? snapshotTargets : defaultProfileTargets
}
