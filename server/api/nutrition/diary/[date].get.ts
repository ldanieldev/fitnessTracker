import { and, asc, eq } from 'drizzle-orm'
import type { EntryType, TargetDirection } from '~~/shared/types/nutrition'
import {
  diaryDays,
  diaryDayTargets,
  diaryEntries,
  diaryEntryNutrients,
  diaryMealTimes,
  mealContainers,
  nutrients
} from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadDayNote } from '~~/server/utils/days/notes'
import { loadDefaultHistory } from '~~/server/utils/nutrition/targetHistory'
import { snapshotOn } from '~~/shared/utils/goalHistory'
import { parseDiaryDate } from '~~/server/utils/nutrition/day'
import { nutrientCatalog } from '~~/server/utils/nutrition/nutrientIds'
import { requireUserId } from '~~/server/utils/session'
import { ensureEnergyTarget } from '~~/shared/utils/nutritionTargets'

interface Target {
  key: string
  name: string
  unit: string
  amount: number
  direction: TargetDirection
}

interface Entry {
  id: number
  containerId: number
  entryType: EntryType
  foodId: number | null
  foodServingId: number | null
  recipeId: number | null
  quantity: number
  unitLabel: string
  gramsResolved: number | null
  description: string | null
  brandSnapshot: string | null
  loggedAt: Date
  notes: string | null
  ingredientSnapshot: unknown
  nutrients: Record<string, number>
}

function addNutrients(totals: Record<string, number>, entryNutrients: Record<string, number>) {
  for (const [key, amount] of Object.entries(entryNutrients)) {
    totals[key] = (totals[key] ?? 0) + amount
  }
}

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const date = parseDiaryDate(getRouterParam(event, 'date'))

  const day = await db
    .select({ id: diaryDays.id, goalProfileId: diaryDays.goalProfileId, incomplete: diaryDays.incomplete })
    .from(diaryDays)
    .where(and(eq(diaryDays.userId, userId), eq(diaryDays.date, date)))
    .then((r) => r[0])

  const catalog = await nutrientCatalog()
  const energyEntry = catalog.find((n) => n.key === 'energy')
  const makeEnergyTarget = (amount: number): Target => ({
    key: 'energy',
    name: energyEntry!.name,
    unit: 'kcal',
    amount,
    direction: energyEntry!.defaultDirection
  })

  let targets: Target[]
  let defaultProfileName: string | null = null
  if (day && day.goalProfileId !== null) {
    targets = await db
      .select({
        key: nutrients.key,
        name: nutrients.name,
        unit: nutrients.unit,
        amount: diaryDayTargets.amount,
        direction: diaryDayTargets.direction
      })
      .from(diaryDayTargets)
      .innerJoin(nutrients, eq(nutrients.id, diaryDayTargets.nutrientId))
      .where(eq(diaryDayTargets.dayId, day.id))
      .then((rows) => rows.map((t) => ({ ...t, amount: Number(t.amount) })))
    if (energyEntry) targets = ensureEnergyTarget(targets, makeEnergyTarget, null)
  } else {
    const snapshot = snapshotOn(await loadDefaultHistory(userId), date)
    defaultProfileName = snapshot?.profileName ?? null
    const byKey = new Map(catalog.map((n) => [n.key, n]))
    targets = (snapshot?.targets ?? []).flatMap((t) => {
      const nutrient = byKey.get(t.key)
      if (!nutrient) return []
      return [{ key: t.key, name: nutrient.name, unit: nutrient.unit, amount: t.amount, direction: t.direction }]
    })
    if (energyEntry && snapshot?.profileName != null) {
      targets = ensureEnergyTarget(targets, makeEnergyTarget, snapshot.calories)
    }
  }

  const allContainers = await db
    .select({
      id: mealContainers.id,
      name: mealContainers.name,
      sortOrder: mealContainers.sortOrder,
      isArchived: mealContainers.isArchived
    })
    .from(mealContainers)
    .where(eq(mealContainers.userId, userId))
    .orderBy(asc(mealContainers.sortOrder))

  const entryRows = day
    ? await db
        .select({
          id: diaryEntries.id,
          containerId: diaryEntries.containerId,
          entryType: diaryEntries.entryType,
          foodId: diaryEntries.foodId,
          foodServingId: diaryEntries.foodServingId,
          recipeId: diaryEntries.recipeId,
          quantity: diaryEntries.quantity,
          unitLabel: diaryEntries.unitLabel,
          gramsResolved: diaryEntries.gramsResolved,
          description: diaryEntries.description,
          brandSnapshot: diaryEntries.brandSnapshot,
          loggedAt: diaryEntries.loggedAt,
          notes: diaryEntries.notes,
          ingredientSnapshot: diaryEntries.ingredientSnapshot,
          nutrientKey: nutrients.key,
          nutrientAmount: diaryEntryNutrients.amount
        })
        .from(diaryEntries)
        .leftJoin(diaryEntryNutrients, eq(diaryEntryNutrients.entryId, diaryEntries.id))
        .leftJoin(nutrients, eq(nutrients.id, diaryEntryNutrients.nutrientId))
        .where(eq(diaryEntries.dayId, day.id))
        .orderBy(asc(diaryEntries.sortOrder))
    : []

  const entryMap = new Map<number, Entry>()
  for (const row of entryRows) {
    let entry = entryMap.get(row.id)
    if (!entry) {
      entry = {
        id: row.id,
        containerId: row.containerId,
        entryType: row.entryType as EntryType,
        foodId: row.foodId,
        foodServingId: row.foodServingId,
        recipeId: row.recipeId,
        quantity: Number(row.quantity),
        unitLabel: row.unitLabel,
        gramsResolved: row.gramsResolved === null ? null : Number(row.gramsResolved),
        description: row.description,
        brandSnapshot: row.brandSnapshot,
        loggedAt: row.loggedAt,
        notes: row.notes,
        ingredientSnapshot: row.ingredientSnapshot,
        nutrients: {}
      }
      entryMap.set(row.id, entry)
    }
    if (row.nutrientKey !== null && row.nutrientAmount !== null) {
      entry.nutrients[row.nutrientKey] = Number(row.nutrientAmount)
    }
  }
  const entries = [...entryMap.values()]

  const archivedWithEntries = new Set(
    entries
      .map((e) => allContainers.find((c) => c.id === e.containerId))
      .filter((c) => c?.isArchived)
      .map((c) => c!.id)
  )

  const mealTimeRows = day
    ? await db
        .select({ containerId: diaryMealTimes.containerId, time: diaryMealTimes.time })
        .from(diaryMealTimes)
        .where(eq(diaryMealTimes.dayId, day.id))
    : []
  const mealTimes = new Map(mealTimeRows.map((r) => [r.containerId, r.time]))

  const containers = allContainers
    .filter((c) => !c.isArchived || archivedWithEntries.has(c.id))
    .map((c) => {
      const containerEntries = entries.filter((e) => e.containerId === c.id)
      const subtotals: Record<string, number> = {}
      for (const entry of containerEntries) {
        addNutrients(subtotals, entry.nutrients)
      }
      return {
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        isArchived: c.isArchived,
        entries: containerEntries,
        subtotals,
        mealTime: mealTimes.get(c.id) ?? null
      }
    })

  const totals: Record<string, number> = {}
  for (const entry of entries) {
    addNutrients(totals, entry.nutrients)
  }

  return {
    date,
    persisted: Boolean(day),
    notes: await loadDayNote(userId, date),
    incomplete: day?.incomplete ?? false,
    defaultProfileName,
    goalProfileId: day?.goalProfileId ?? null,
    targets,
    containers,
    entries,
    totals
  }
})
