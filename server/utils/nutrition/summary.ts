import { and, eq, gte, inArray, lte, sum } from 'drizzle-orm'
import { z } from 'zod'
import type { TargetDirection } from '~~/shared/types/nutrition'
import {
  diaryDayTargets,
  diaryDays,
  diaryEntries,
  diaryEntryNutrients,
  goalProfiles,
  nutrients
} from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { parseDiaryDate, resolveDayTargets } from '~~/server/utils/nutrition/day'
import { nutrientCatalog } from '~~/server/utils/nutrition/nutrientIds'
import { parseWith } from '~~/server/utils/nutrition/parseBody'
import { loadDefaultHistory } from '~~/server/utils/nutrition/targetHistory'
import { loadTrackedNutrients } from '~~/server/utils/nutrition/trackedNutrients'
import { snapshotOn } from '~~/shared/utils/goalHistory'
import { enumerateDates } from '~~/shared/utils/nutritionSummary'
import { ensureEnergyTarget } from '~~/shared/utils/nutritionTargets'

export interface RangeDay {
  date: string
  logged: boolean
  incomplete: boolean
  totals: Record<string, number | null>
  targets: Record<string, { amount: number; direction: TargetDirection }> | null
  profileName: string | null
}

export interface IntakeRange {
  nutrients: Array<{ key: string; name: string; unit: string }>
  days: RangeDay[]
}

const rangeQuerySchema = z.object({ from: z.string(), to: z.string() })

export function parseIntakeRangeQuery(query: Record<string, unknown>): { from: string; to: string; dates: string[] } {
  const parsed = parseWith(rangeQuerySchema, query)

  const from = parseDiaryDate(parsed.from)
  const to = parseDiaryDate(parsed.to)
  if (from > to) {
    throw createError({ statusCode: 400, statusMessage: 'from must be before to' })
  }

  const dates = enumerateDates(from, to)
  if (dates.length > 400) {
    throw createError({ statusCode: 400, statusMessage: 'Range too large' })
  }

  return { from, to, dates }
}

export async function loadIntakeRange(
  userId: number,
  from: string,
  to: string,
  dates: string[] = enumerateDates(from, to)
): Promise<IntakeRange> {
  const tracked = await loadTrackedNutrients(db, userId)
  const trackedKeys = new Set(tracked.map((n) => n.key))
  const nutrientRows = tracked.map((n) => ({ key: n.key, name: n.name, unit: n.unit }))

  const dayRows = await db
    .select({
      id: diaryDays.id,
      date: diaryDays.date,
      goalProfileId: diaryDays.goalProfileId,
      incomplete: diaryDays.incomplete,
      profileName: goalProfiles.name,
      calories: goalProfiles.calories
    })
    .from(diaryDays)
    .leftJoin(goalProfiles, eq(goalProfiles.id, diaryDays.goalProfileId))
    .where(and(eq(diaryDays.userId, userId), gte(diaryDays.date, from), lte(diaryDays.date, to)))

  const dayIds = dayRows.map((d) => d.id)

  const history = await loadDefaultHistory(userId)
  const defaultTargetsOn = (date: string) => {
    const snapshot = snapshotOn(history, date)
    const out: Record<string, { amount: number; direction: TargetDirection }> = {}
    for (const row of snapshot?.targets ?? []) {
      if (trackedKeys.has(row.key)) out[row.key] = { amount: row.amount, direction: row.direction }
    }
    return { snapshot, targets: out }
  }

  const targetRows = dayIds.length
    ? await db
        .select({
          dayId: diaryDayTargets.dayId,
          key: nutrients.key,
          amount: diaryDayTargets.amount,
          direction: diaryDayTargets.direction
        })
        .from(diaryDayTargets)
        .innerJoin(nutrients, eq(nutrients.id, diaryDayTargets.nutrientId))
        .where(inArray(diaryDayTargets.dayId, dayIds))
    : []

  const totalRows = dayIds.length
    ? await db
        .select({ dayId: diaryEntries.dayId, key: nutrients.key, total: sum(diaryEntryNutrients.amount) })
        .from(diaryEntries)
        .innerJoin(diaryEntryNutrients, eq(diaryEntryNutrients.entryId, diaryEntries.id))
        .innerJoin(nutrients, eq(nutrients.id, diaryEntryNutrients.nutrientId))
        .where(inArray(diaryEntries.dayId, dayIds))
        .groupBy(diaryEntries.dayId, nutrients.key)
    : []

  const targetsByDay = new Map<number, Record<string, { amount: number; direction: TargetDirection }>>()
  for (const row of targetRows) {
    if (!trackedKeys.has(row.key)) continue
    const rec = targetsByDay.get(row.dayId) ?? {}
    rec[row.key] = { amount: Number(row.amount), direction: row.direction as TargetDirection }
    targetsByDay.set(row.dayId, rec)
  }

  const totalsByDay = new Map<number, Record<string, number>>()
  for (const row of totalRows) {
    const rec = totalsByDay.get(row.dayId) ?? {}
    rec[row.key] = Number(row.total)
    totalsByDay.set(row.dayId, rec)
  }

  const dayByDate = new Map(dayRows.map((d) => [d.date, d]))
  const energyEntry = trackedKeys.has('energy') ? (await nutrientCatalog()).find((n) => n.key === 'energy') : undefined

  const days: RangeDay[] = dates.map((date) => {
    const day = dayByDate.get(date)
    if (!day) {
      const totals: Record<string, number | null> = {}
      for (const n of nutrientRows) totals[n.key] = null
      return { date, logged: false, incomplete: false, totals, targets: null, profileName: null }
    }

    const dayTotals = totalsByDay.get(day.id) ?? {}
    const totals: Record<string, number | null> = {}
    for (const n of nutrientRows) totals[n.key] = dayTotals[n.key] ?? 0

    const usesDefault = day.goalProfileId === null
    const fallback = defaultTargetsOn(date)
    const calories = usesDefault ? (fallback.snapshot?.calories ?? null) : day.calories
    const profileName = usesDefault ? (fallback.snapshot?.profileName ?? null) : day.profileName

    let targets = resolveDayTargets(day.goalProfileId, targetsByDay.get(day.id) ?? {}, fallback.targets)
    if (energyEntry) {
      const rows = Object.entries(targets).map(([key, t]) => ({ key, ...t }))
      const withEnergy = ensureEnergyTarget(
        rows,
        (amount) => ({ key: 'energy', amount, direction: energyEntry.defaultDirection }),
        calories === null ? null : Number(calories)
      )
      targets = Object.fromEntries(withEnergy.map(({ key, ...rest }) => [key, rest]))
    }

    return { date, logged: true, incomplete: day.incomplete, totals, targets, profileName }
  })

  return { nutrients: nutrientRows, days }
}
