import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import type { DayNote } from '~~/shared/types/days'
import { dayNotes } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { isoDate } from '~~/server/utils/body/input'

export const DAY_NOTE_MAX = 5000

export const dayNotePutSchema = z.object({ note: z.string().max(DAY_NOTE_MAX).nullable() })

export const dayNoteListSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(400).default(100)
})

export async function loadDayNote(userId: number, date: string): Promise<string | null> {
  return db
    .select({ body: dayNotes.body })
    .from(dayNotes)
    .where(and(eq(dayNotes.userId, userId), eq(dayNotes.day, date)))
    .then((r) => r[0]?.body ?? null)
}

export async function saveDayNote(userId: number, date: string, note: string | null): Promise<string | null> {
  const body = note?.trim() || null
  if (body === null) {
    await db.delete(dayNotes).where(and(eq(dayNotes.userId, userId), eq(dayNotes.day, date)))
    return null
  }
  await db
    .insert(dayNotes)
    .values({ userId, day: date, body })
    .onConflictDoUpdate({ target: [dayNotes.userId, dayNotes.day], set: { body, updatedAt: new Date() } })
  return body
}

export async function listDayNotes(
  userId: number,
  range: { from?: string; to?: string; limit: number }
): Promise<DayNote[]> {
  return db
    .select({ date: dayNotes.day, note: dayNotes.body })
    .from(dayNotes)
    .where(
      and(
        eq(dayNotes.userId, userId),
        range.from ? gte(dayNotes.day, range.from) : undefined,
        range.to ? lte(dayNotes.day, range.to) : undefined
      )
    )
    .orderBy(desc(dayNotes.day))
    .limit(range.limit)
}
