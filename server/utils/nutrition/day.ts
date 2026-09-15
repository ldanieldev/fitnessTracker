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

// Concurrent first writes to a date race here: the (user_id, date) unique index plus onConflictDoNothing sends the loser to the final select. goalProfileId stays null so the day follows the current default (resolveDayTargets).
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

export function resolveDayTargets<T>(goalProfileId: number | null, snapshotTargets: T, defaultProfileTargets: T): T {
  return goalProfileId !== null ? snapshotTargets : defaultProfileTargets
}
