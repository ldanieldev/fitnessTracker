import { and, eq, max } from 'drizzle-orm'
import { diaryEntries, mealContainers } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { ensureDay, parseDiaryDate } from '~~/server/utils/nutrition/day'
import { entryPostSchema, resolveEntryInput, writeEntry } from '~~/server/utils/nutrition/entry'
import { loadFood } from '~~/server/utils/nutrition/loadFood'
import { nutrientIdMap } from '~~/server/utils/nutrition/nutrientIds'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { loadSavedMeal } from '~~/server/utils/nutrition/savedMeal'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const date = parseDiaryDate(getRouterParam(event, 'date'))
  const body = await parseBody(event, entryPostSchema)

  const ids = await db.transaction(async (tx) => {
    const day = await ensureDay(tx, userId, date)
    const nutrientIds = await nutrientIdMap()
    const knownContainers = new Set<number>()
    const nextSortOrder = new Map<number, number>()
    const results: number[] = []

    const nextSortOrderFor = async (containerId: number) => {
      const cached = nextSortOrder.get(containerId)
      const sortOrder = cached === undefined
        ? await tx
            .select({ max: max(diaryEntries.sortOrder) })
            .from(diaryEntries)
            .where(and(eq(diaryEntries.dayId, day.id), eq(diaryEntries.containerId, containerId)))
            .then((r) => (r[0]?.max ?? -1) + 1)
        : cached
      nextSortOrder.set(containerId, sortOrder + 1)
      return sortOrder
    }

    for (const input of body) {
      if (!knownContainers.has(input.containerId)) {
        const container = await tx
          .select({ id: mealContainers.id })
          .from(mealContainers)
          .where(and(eq(mealContainers.id, input.containerId), eq(mealContainers.userId, userId)))
          .then((r) => r[0])
        if (!container) throw createError({ statusCode: 404, statusMessage: 'Container not found' })
        knownContainers.add(input.containerId)
      }

      if (input.savedMealId) {
        const savedMeal = await loadSavedMeal(tx, userId, input.savedMealId)
        if (!savedMeal) throw createError({ statusCode: 404, statusMessage: 'Saved meal not found' })

        for (const item of savedMeal.items) {
          const food = await loadFood(tx, userId, item.foodId)
          if (!food) throw createError({ statusCode: 400, statusMessage: 'SAVED_MEAL_ITEM_MISSING' })

          const itemInput = {
            entryType: 'food' as const,
            containerId: input.containerId,
            foodId: item.foodId,
            quantity: item.quantity,
            unitLabel: item.unitLabel,
            loggedAt: input.loggedAt
          }
          const resolvedArgs = await resolveEntryInput(tx, userId, itemInput, nutrientIds)
          const sortOrder = await nextSortOrderFor(input.containerId)
          const entry = await writeEntry(tx, { dayId: day.id, sortOrder, ...resolvedArgs })
          results.push(entry.id)
        }
        continue
      }

      const resolvedArgs = await resolveEntryInput(tx, userId, input, nutrientIds)
      const sortOrder = await nextSortOrderFor(input.containerId)
      const entry = await writeEntry(tx, { dayId: day.id, sortOrder, ...resolvedArgs })
      results.push(entry.id)
    }

    return results
  })

  return { ids }
})
