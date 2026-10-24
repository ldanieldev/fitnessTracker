import { and, eq, inArray, max } from 'drizzle-orm'
import { z } from 'zod'
import { diaryDays, diaryEntries, diaryEntryNutrients, mealContainers } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { ensureDay, parseDiaryDate } from '~~/server/utils/nutrition/day'
import { selectStoredUnit, writeEntry, type WriteEntryArgs } from '~~/server/utils/nutrition/entry'
import { loadFood } from '~~/server/utils/nutrition/loadFood'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import { recordFoodUsage } from '~~/server/utils/nutrition/usage'
import { applyOverrides } from '~~/shared/utils/nutritionCopy'
import { scaleSnapshot } from '~~/shared/utils/nutritionDerive'
import { scaleStoredIngredientSnapshot } from '~~/shared/utils/nutritionRecipe'
import { NoWeightBasisError, resolveNutrition } from '~~/shared/utils/nutritionResolve'
import { normalizeUnitLabel } from '~~/shared/utils/nutritionUnits'
import { calendarDateSchema, zId } from '~~/server/utils/validation'
import { todayDate } from '~~/shared/utils/nutritionSummary'

const UNITLESS = { quick_add: 'quick-add', recipe: 'recipe entry' } as const

function msBetweenDates(from: string, to: string): number {
  return Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)
}

function normalizedLabelValue(raw: string): string {
  const normalized = normalizeUnitLabel(raw)
  return normalized.kind === 'weight' ? normalized.unit : normalized.label
}

const copySchema = z.object({
  sourceEntryIds: z.array(zId).min(1).max(200),
  targetDate: calendarDateSchema,
  today: calendarDateSchema.optional(),
  targetContainerId: zId.nullable().default(null),
  overrides: z
    .array(
      z.object({
        sourceEntryId: zId,
        quantity: z.number().optional(),
        unitLabel: z.string().max(64).optional(),
        exclude: z.boolean().optional()
      })
    )
    .max(200)
    .default([])
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, copySchema)
  const targetDate = parseDiaryDate(body.targetDate)
  const today = body.today ?? todayDate()
  const sourceEntryIds = [...new Set(body.sourceEntryIds)]

  return db.transaction(async (tx) => {
    const sourceRows = await tx
      .select({
        id: diaryEntries.id,
        date: diaryDays.date,
        loggedAt: diaryEntries.loggedAt,
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
        ingredientSnapshot: diaryEntries.ingredientSnapshot
      })
      .from(diaryEntries)
      .innerJoin(diaryDays, eq(diaryDays.id, diaryEntries.dayId))
      .where(and(inArray(diaryEntries.id, sourceEntryIds), eq(diaryDays.userId, userId)))

    const sourceById = new Map(sourceRows.map((row) => [row.id, row]))
    if (sourceById.size !== sourceEntryIds.length) {
      throw createError({ statusCode: 404, statusMessage: 'Entry not found' })
    }

    const sources = sourceEntryIds.map((id) => {
      const row = sourceById.get(id)!
      return { id: row.id, containerId: row.containerId, quantity: Number(row.quantity), unitLabel: row.unitLabel }
    })

    let plan
    try {
      plan = applyOverrides(sources, body.overrides, body.targetContainerId)
    } catch (err) {
      throw createError({ statusCode: 400, statusMessage: (err as Error).message })
    }

    const targetContainerIds = new Set(plan.map((item) => item.containerId))
    for (const containerId of targetContainerIds) {
      const container = await tx
        .select({ id: mealContainers.id })
        .from(mealContainers)
        .where(and(eq(mealContainers.id, containerId), eq(mealContainers.userId, userId)))
        .then((r) => r[0])
      if (!container) throw createError({ statusCode: 404, statusMessage: 'Container not found' })
    }

    const day = await ensureDay(tx, userId, targetDate)

    const ids: number[] = []
    const fellBackToSnapshot: number[] = []
    const nextSortOrder = new Map<number, number>()

    for (const item of plan) {
      const source = sourceById.get(item.sourceEntryId)!
      const sourceQuantity = Number(source.quantity)
      const quantityChanged = item.quantity !== sourceQuantity
      const ratio = item.quantity / sourceQuantity

      const snapshotRows = await tx
        .select({ nutrientId: diaryEntryNutrients.nutrientId, amount: diaryEntryNutrients.amount })
        .from(diaryEntryNutrients)
        .where(eq(diaryEntryNutrients.entryId, source.id))
      const sourceSnapshot: Record<number, number> = {}
      for (const row of snapshotRows) sourceSnapshot[row.nutrientId] = Number(row.amount)

      const scaledSnapshot = quantityChanged
        ? scaleSnapshot(sourceSnapshot, sourceQuantity, item.quantity)
        : sourceSnapshot
      const sourceGrams = source.gramsResolved === null ? null : Number(source.gramsResolved)
      const scaledGrams = sourceGrams === null ? null : quantityChanged ? sourceGrams * ratio : sourceGrams
      const scaledIngredientSnapshot = quantityChanged
        ? scaleStoredIngredientSnapshot(source.ingredientSnapshot, ratio)
        : source.ingredientSnapshot

      // Keeps the source's UTC time of day (no client timezone here), so across a DST change local time shifts an hour.
      const loggedAt =
        targetDate === today
          ? new Date()
          : new Date(source.loggedAt.getTime() + msBetweenDates(source.date, targetDate))

      let args: Omit<WriteEntryArgs, 'dayId' | 'sortOrder'>

      if (source.entryType === 'quick_add' || source.entryType === 'recipe') {
        // As in the entry edit route: with no units to convert between, a new label would misstate the amount.
        if (normalizedLabelValue(item.unitLabel) !== normalizedLabelValue(source.unitLabel)) {
          const kind = UNITLESS[source.entryType]
          throw createError({ statusCode: 400, statusMessage: `Cannot change the unit of a ${kind}` })
        }
        args = {
          entryType: source.entryType,
          containerId: item.containerId,
          quantity: item.quantity,
          unitLabel: source.unitLabel,
          gramsResolved: scaledGrams,
          foodId: source.foodId,
          foodServingId: source.foodServingId,
          recipeId: source.recipeId,
          description: source.description,
          brandSnapshot: source.brandSnapshot,
          ingredientSnapshot: scaledIngredientSnapshot,
          notes: null,
          loggedAt,
          nutrients: scaledSnapshot
        }
      } else {
        const food = await loadFood(tx, userId, source.foodId!)
        if (!food) {
          fellBackToSnapshot.push(source.id)
          args = {
            entryType: 'food',
            containerId: item.containerId,
            quantity: item.quantity,
            unitLabel: source.unitLabel,
            gramsResolved: scaledGrams,
            foodId: source.foodId,
            foodServingId: source.foodServingId,
            recipeId: null,
            description: source.description,
            brandSnapshot: source.brandSnapshot,
            ingredientSnapshot: source.ingredientSnapshot,
            notes: null,
            loggedAt,
            nutrients: scaledSnapshot
          }
        } else {
          const selected = selectStoredUnit(
            food,
            item.unitLabel,
            item.unitLabel === source.unitLabel ? source.foodServingId : null
          )

          let resolved
          try {
            resolved = resolveNutrition(food, selected.selection, item.quantity)
          } catch (err) {
            if (err instanceof NoWeightBasisError) {
              throw createError({
                statusCode: 400,
                statusMessage: 'NO_WEIGHT_BASIS',
                data: { code: 'NO_WEIGHT_BASIS' }
              })
            }
            throw err
          }
          await recordFoodUsage(tx, userId, food.id)

          args = {
            entryType: 'food',
            containerId: item.containerId,
            quantity: item.quantity,
            unitLabel: selected.unitLabel,
            gramsResolved: resolved.gramsResolved,
            foodId: food.id,
            foodServingId: selected.foodServingId,
            recipeId: null,
            description: food.name,
            brandSnapshot: food.brand,
            ingredientSnapshot: null,
            notes: null,
            loggedAt,
            nutrients: resolved.nutrients
          }
        }
      }

      const cachedSortOrder = nextSortOrder.get(item.containerId)
      const sortOrder =
        cachedSortOrder === undefined
          ? await tx
              .select({ max: max(diaryEntries.sortOrder) })
              .from(diaryEntries)
              .where(and(eq(diaryEntries.dayId, day.id), eq(diaryEntries.containerId, item.containerId)))
              .then((r) => (r[0]?.max ?? -1) + 1)
          : cachedSortOrder
      nextSortOrder.set(item.containerId, sortOrder + 1)

      const entry = await writeEntry(tx, { dayId: day.id, sortOrder, ...args })
      ids.push(entry.id)
    }

    return { ids, fellBackToSnapshot }
  })
})
