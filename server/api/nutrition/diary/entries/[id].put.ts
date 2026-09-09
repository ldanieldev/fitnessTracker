import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { diaryDays, diaryEntries, diaryEntryNutrients, mealContainers } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { selectUnit } from '~~/server/utils/nutrition/entry'
import { loadFood } from '~~/server/utils/nutrition/loadFood'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/nutrition/session'
import { scaleSnapshot } from '~~/shared/utils/nutritionDerive'
import { NoWeightBasisError, resolveNutrition } from '~~/shared/utils/nutritionResolve'
import { normalizeUnitLabel } from '~~/shared/utils/nutritionUnits'

const entryPatchSchema = z.object({
  quantity: z.number().positive().optional(),
  unitLabel: z.string().trim().min(1).max(64).optional(),
  containerId: z.number().int().optional(),
  loggedAt: z.coerce.date().optional(),
  notes: z.string().max(2000).nullish()
})

function normalizedLabelValue(raw: string): string {
  const normalized = normalizeUnitLabel(raw)
  return normalized.kind === 'weight' ? normalized.unit : normalized.label
}

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const entryId = Number(getRouterParam(event, 'id'))

  const body = await parseBody(event, entryPatchSchema)

  await db.transaction(async (tx) => {
    const entry = await tx
      .select({
        id: diaryEntries.id,
        entryType: diaryEntries.entryType,
        foodId: diaryEntries.foodId,
        quantity: diaryEntries.quantity,
        unitLabel: diaryEntries.unitLabel,
        gramsResolved: diaryEntries.gramsResolved
      })
      .from(diaryEntries)
      .innerJoin(diaryDays, eq(diaryDays.id, diaryEntries.dayId))
      .where(and(eq(diaryEntries.id, entryId), eq(diaryDays.userId, userId)))
      .then((r) => r[0])
    if (!entry) throw createError({ statusCode: 404, statusMessage: 'Entry not found' })

    const unitChanged =
      body.unitLabel !== undefined && normalizedLabelValue(body.unitLabel) !== normalizedLabelValue(entry.unitLabel)

    if (unitChanged) {
      if (entry.entryType === 'quick_add') {
        throw createError({ statusCode: 400, statusMessage: 'Cannot change the unit of a quick-add' })
      }
      if (entry.entryType === 'recipe') {
        throw createError({ statusCode: 400, statusMessage: 'Cannot change the unit of a recipe entry' })
      }

      const food = await loadFood(tx, userId, entry.foodId!)
      if (!food) throw createError({ statusCode: 404, statusMessage: 'Food not found' })

      const { selection, unitLabel, foodServingId } = selectUnit(food, body.unitLabel!)
      const quantity = body.quantity ?? Number(entry.quantity)

      let resolved
      try {
        resolved = resolveNutrition(food, selection, quantity)
      } catch (err) {
        if (err instanceof NoWeightBasisError) {
          throw createError({ statusCode: 400, statusMessage: 'NO_WEIGHT_BASIS', data: { code: 'NO_WEIGHT_BASIS' } })
        }
        throw err
      }

      await tx.delete(diaryEntryNutrients).where(eq(diaryEntryNutrients.entryId, entry.id))
      const rows = Object.entries(resolved.nutrients).map(([nutrientId, amount]) => ({
        entryId: entry.id,
        nutrientId: Number(nutrientId),
        amount: String(amount)
      }))
      if (rows.length) await tx.insert(diaryEntryNutrients).values(rows)

      await tx
        .update(diaryEntries)
        .set({
          quantity: String(quantity),
          unitLabel,
          gramsResolved: resolved.gramsResolved === null ? null : String(resolved.gramsResolved),
          foodServingId
        })
        .where(eq(diaryEntries.id, entry.id))
    } else if (body.quantity !== undefined) {
      const oldQuantity = Number(entry.quantity)
      const rows = await tx
        .select({ nutrientId: diaryEntryNutrients.nutrientId, amount: diaryEntryNutrients.amount })
        .from(diaryEntryNutrients)
        .where(eq(diaryEntryNutrients.entryId, entry.id))

      const snapshot: Record<number, number> = {}
      for (const row of rows) snapshot[row.nutrientId] = Number(row.amount)
      const scaled = scaleSnapshot(snapshot, oldQuantity, body.quantity)

      for (const [nutrientId, amount] of Object.entries(scaled)) {
        await tx
          .update(diaryEntryNutrients)
          .set({ amount: String(amount) })
          .where(
            and(eq(diaryEntryNutrients.entryId, entry.id), eq(diaryEntryNutrients.nutrientId, Number(nutrientId)))
          )
      }

      const ratio = body.quantity / oldQuantity
      const gramsResolved = entry.gramsResolved === null ? null : Number(entry.gramsResolved) * ratio

      await tx
        .update(diaryEntries)
        .set({
          quantity: String(body.quantity),
          gramsResolved: gramsResolved === null ? null : String(gramsResolved)
        })
        .where(eq(diaryEntries.id, entry.id))
    }

    const plainUpdates: Partial<typeof diaryEntries.$inferInsert> = {}
    if (body.containerId !== undefined) {
      const container = await tx
        .select({ id: mealContainers.id })
        .from(mealContainers)
        .where(and(eq(mealContainers.id, body.containerId), eq(mealContainers.userId, userId)))
        .then((r) => r[0])
      if (!container) throw createError({ statusCode: 404, statusMessage: 'Container not found' })
      plainUpdates.containerId = body.containerId
    }
    if (body.loggedAt !== undefined) plainUpdates.loggedAt = body.loggedAt
    if (body.notes !== undefined) plainUpdates.notes = body.notes

    if (Object.keys(plainUpdates).length) {
      await tx.update(diaryEntries).set(plainUpdates).where(eq(diaryEntries.id, entry.id))
    }
  })

  return { ok: true }
})
