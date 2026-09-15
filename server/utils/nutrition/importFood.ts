import { and, eq, isNull } from 'drizzle-orm'
import { foods, foodServings, foodSources } from '~~/server/db/schema'
import { toGtin13 } from '~~/shared/utils/gtin'
import type { DbClient, RootDbClient } from '../db'
import { isUniqueViolation } from '../pgError'
import { createFoodRecord } from './createFood'
import { mapExternalFood } from './external/mapExternalFood'
import type { ExternalFood } from './external/types'
import { buildServingRows } from './foodInput'
import { nutrientIdMap } from './nutrientIds'

export interface ImportTargetInput {
  existingBySource: { id: number } | null
  existingByBarcode: { id: number } | null
  persistable: boolean
}

export type ImportTarget =
  | { action: 'reuse', id: number }
  | { action: 'create-catalog' }
  | { action: 'create-owned' }

export function resolveImportTarget({ existingBySource, existingByBarcode, persistable }: ImportTargetInput): ImportTarget {
  if (existingBySource) return { action: 'reuse', id: existingBySource.id }
  if (existingByBarcode) return { action: 'reuse', id: existingByBarcode.id }
  return persistable ? { action: 'create-catalog' } : { action: 'create-owned' }
}

export interface ImportedFood {
  id: number
  needsNutrition: boolean
  owned: boolean
}

// Stored barcodes are GTIN-13 (mapExternalFood normalises on import); look up by the same key or a 12-digit UPC misses its GTIN-13 row.
export function importBarcodeKey(external: Pick<ExternalFood, 'barcode'>): string | null {
  return external.barcode ? toGtin13(external.barcode) : null
}

export async function insertOrRecover<T>(
  db: RootDbClient,
  insert: (tx: DbClient) => Promise<T>,
  recover: () => Promise<T | null>
): Promise<T> {
  try {
    return await db.transaction(insert)
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    const recovered = await recover()
    if (recovered) return recovered
    throw err
  }
}

async function requireSource(db: DbClient, key: ExternalFood['source']) {
  const source = await db.select().from(foodSources).where(eq(foodSources.key, key)).limit(1).then((r) => r[0])
  if (!source) throw new Error(`Unknown food source: ${key}`)
  return source
}

async function findExistingImportedFood(
  db: DbClient,
  userId: number,
  external: ExternalFood,
  source: { id: number, persistable: boolean }
): Promise<ImportedFood | null> {
  const existingBySource = await db
    .select({ id: foods.id })
    .from(foods)
    .where(
      and(
        eq(foods.sourceId, source.id),
        eq(foods.externalId, external.externalId),
        isNull(foods.deletedAt),
        source.persistable ? isNull(foods.createdByUserId) : eq(foods.createdByUserId, userId)
      )
    )
    .limit(1)
    .then((r) => r[0] ?? null)

  const barcodeKey = importBarcodeKey(external)
  const existingByBarcode = source.persistable && barcodeKey
    ? await db
        .select({ id: foods.id })
        .from(foods)
        .where(and(eq(foods.barcode, barcodeKey), isNull(foods.createdByUserId), isNull(foods.deletedAt)))
        .limit(1)
        .then((r) => r[0] ?? null)
    : null

  const target = resolveImportTarget({ existingBySource, existingByBarcode, persistable: source.persistable })
  if (target.action !== 'reuse') return null

  const liveServings = await db
    .select({ id: foodServings.id })
    .from(foodServings)
    .where(and(eq(foodServings.foodId, target.id), isNull(foodServings.deletedAt)))
  return { id: target.id, needsNutrition: liveServings.length === 0, owned: !source.persistable }
}

export async function importExternalFood(db: RootDbClient, userId: number, external: ExternalFood): Promise<ImportedFood> {
  const source = await requireSource(db, external.source)

  const existing = await findExistingImportedFood(db, userId, external, source)
  if (existing) return existing

  const mapped = mapExternalFood(external)
  let prepared
  try {
    prepared = buildServingRows(mapped.servings, await nutrientIdMap()).map((serving) => ({
      ...serving,
      origin: 'import' as const
    }))
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }

  // A concurrent import can win the race to this insert; the (source_id, external_id) unique indexes catch it and insertOrRecover returns the winner instead of a 500.
  return insertOrRecover(
    db,
    async (tx) => {
      const created = await createFoodRecord(tx, {
        ownerId: source.persistable ? null : userId,
        sourceId: source.id,
        externalId: external.externalId,
        barcode: mapped.barcode,
        name: mapped.name,
        brand: mapped.brand,
        prepared
      })
      return { id: created.id, needsNutrition: prepared.length === 0, owned: !source.persistable }
    },
    () => findExistingImportedFood(db, userId, external, source)
  )
}
