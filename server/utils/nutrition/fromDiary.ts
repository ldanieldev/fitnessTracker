import { and, asc, eq } from 'drizzle-orm'
import { diaryDays, diaryEntries, mealContainers } from '~~/server/db/schema'
import { db } from '../db'
import { parseDiaryDate } from './day'

export interface FlattenedItem {
  foodId: number
  quantity: number
  unitLabel: string
}

export interface FlattenedContainer {
  items: FlattenedItem[]
  skippedQuickAdds: number
  flattenedRecipes: number
}

interface IngredientSnapshotItem {
  foodId: number
  quantity: number
  unitLabel: string
}

export async function loadContainerEntriesForUser(userId: number, rawDate: string, containerId: number) {
  const date = parseDiaryDate(rawDate)

  const day = await db
    .select({ id: diaryDays.id })
    .from(diaryDays)
    .where(and(eq(diaryDays.userId, userId), eq(diaryDays.date, date)))
    .then((r) => r[0])
  if (!day) throw createError({ statusCode: 404, statusMessage: 'Day not found' })

  const container = await db
    .select({ id: mealContainers.id })
    .from(mealContainers)
    .where(and(eq(mealContainers.id, containerId), eq(mealContainers.userId, userId)))
    .then((r) => r[0])
  if (!container) throw createError({ statusCode: 404, statusMessage: 'Container not found' })

  return db
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.dayId, day.id), eq(diaryEntries.containerId, container.id)))
    .orderBy(asc(diaryEntries.sortOrder))
}

export function flattenContainerEntries(entries: Array<typeof diaryEntries.$inferSelect>): FlattenedContainer {
  const items: FlattenedItem[] = []
  let skippedQuickAdds = 0
  let flattenedRecipes = 0

  for (const entry of entries) {
    if (entry.entryType === 'food') {
      if (entry.foodId === null) continue
      items.push({ foodId: entry.foodId, quantity: Number(entry.quantity), unitLabel: entry.unitLabel })
    } else if (entry.entryType === 'quick_add') {
      skippedQuickAdds++
    } else if (entry.entryType === 'recipe') {
      const snapshot = (entry.ingredientSnapshot ?? []) as IngredientSnapshotItem[]
      for (const ingredient of snapshot) {
        items.push({ foodId: ingredient.foodId, quantity: ingredient.quantity, unitLabel: ingredient.unitLabel })
      }
      flattenedRecipes++
    }
  }

  return { items, skippedQuickAdds, flattenedRecipes }
}
