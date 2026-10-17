import { and, eq, isNull, type SQL } from 'drizzle-orm'
import { foodServings, foodSources, foods } from '~~/server/db/schema'
import { db } from '../db'
import { MeiliIndexProvider } from '../search/meiliIndex'
import {
  SEARCH_INDEX,
  SEARCH_INDEX_SETTINGS,
  foodToSearchDocument,
  visibilityFilter,
  type SearchDocument
} from './searchDocuments'
import type { SearchProvider } from './searchProvider'

export class MeiliSearchProvider extends MeiliIndexProvider<SearchDocument> implements SearchProvider {
  constructor(host: string, apiKey: string) {
    super(host, apiKey, { name: SEARCH_INDEX, settings: SEARCH_INDEX_SETTINGS, visibleTo: visibilityFilter })
  }

  protected async loadDocument(foodId: number): Promise<SearchDocument | null> {
    return (await loadSearchDocuments(and(eq(foods.id, foodId), isNull(foods.deletedAt))))[0] ?? null
  }

  protected loadAllDocuments(): Promise<SearchDocument[]> {
    return loadSearchDocuments(isNull(foods.deletedAt))
  }
}

async function loadSearchDocuments(where: SQL | undefined): Promise<SearchDocument[]> {
  const heads = await db
    .select({
      id: foods.id,
      name: foods.name,
      brand: foods.brand,
      barcode: foods.barcode,
      createdByUserId: foods.createdByUserId,
      sourceKey: foodSources.key
    })
    .from(foods)
    .leftJoin(foodSources, eq(foodSources.id, foods.sourceId))
    .where(where)
  if (!heads.length) return []
  const servings = await db
    .select({ foodId: foodServings.foodId, label: foodServings.label, quantity: foodServings.quantity })
    .from(foodServings)
    .innerJoin(foods, eq(foods.id, foodServings.foodId))
    .where(and(where, isNull(foodServings.deletedAt)))
    .orderBy(foodServings.id)
  const labels = new Map<number, string[]>()
  for (const s of servings) {
    const list = labels.get(s.foodId) ?? []
    list.push(Number(s.quantity) === 1 ? s.label : `${Number(s.quantity)} ${s.label}`)
    labels.set(s.foodId, list)
  }
  return heads.map((head) => foodToSearchDocument(head, labels.get(head.id) ?? [], head.sourceKey ?? 'user'))
}
