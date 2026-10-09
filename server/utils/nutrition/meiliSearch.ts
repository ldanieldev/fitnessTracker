import { and, eq, isNull } from 'drizzle-orm'
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

  protected loadDocument(foodId: number): Promise<SearchDocument | null> {
    return loadSearchDocument(foodId)
  }

  protected async loadAllDocuments(): Promise<SearchDocument[]> {
    const rows = await db.select({ id: foods.id }).from(foods).where(isNull(foods.deletedAt))
    return (await Promise.all(rows.map((r) => loadSearchDocument(r.id)))).filter((d) => d !== null)
  }
}

async function loadSearchDocument(foodId: number): Promise<SearchDocument | null> {
  const head = await db
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
    .where(and(eq(foods.id, foodId), isNull(foods.deletedAt)))
    .limit(1)
    .then((r) => r[0])
  if (!head) return null
  const servings = await db
    .select({ label: foodServings.label, quantity: foodServings.quantity })
    .from(foodServings)
    .where(and(eq(foodServings.foodId, foodId), isNull(foodServings.deletedAt)))
  const labels = servings.map((s) => (Number(s.quantity) === 1 ? s.label : `${Number(s.quantity)} ${s.label}`))
  return foodToSearchDocument(head, labels, head.sourceKey ?? 'user')
}
