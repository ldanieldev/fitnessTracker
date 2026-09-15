import { asc } from 'drizzle-orm'
import { DEFAULT_TRACKED_NUTRIENTS } from '~~/app/constants/nutrition'
import type { NutrientKey, NutrientUnit, TargetDirection } from '~~/shared/types/nutrition'
import { nutrients } from '~~/server/db/schema'
import { db } from '../db'

const EMPTY_CATALOGUE = 'Nutrient catalogue is empty — run migrations'

let cache: Map<string, number> | null = null

export async function nutrientIdMap(): Promise<Map<string, number>> {
  if (!cache) {
    const rows = await db.select({ id: nutrients.id, key: nutrients.key }).from(nutrients)
    if (rows.length === 0) throw new Error(EMPTY_CATALOGUE)
    cache = new Map(rows.map((r) => [r.key, r.id]))
  }
  return cache
}

export async function getNutrientId(key: NutrientKey): Promise<number> {
  const id = (await nutrientIdMap()).get(key)
  if (!id) throw new Error(`Nutrient ${key} is not seeded`)
  return id
}

export interface NutrientCatalogEntry {
  id: number
  key: string
  name: string
  unit: NutrientUnit
  isMacro: boolean
  defaultDirection: TargetDirection
  sortOrder: number
}

let catalogCache: NutrientCatalogEntry[] | null = null

export async function nutrientCatalog(): Promise<NutrientCatalogEntry[]> {
  if (!catalogCache) {
    const rows = await db
      .select({
        id: nutrients.id,
        key: nutrients.key,
        name: nutrients.name,
        unit: nutrients.unit,
        isMacro: nutrients.isMacro,
        defaultDirection: nutrients.defaultDirection,
        sortOrder: nutrients.sortOrder
      })
      .from(nutrients)
      .orderBy(asc(nutrients.sortOrder))
    if (rows.length === 0) throw new Error(EMPTY_CATALOGUE)
    catalogCache = rows
  }
  return catalogCache
}

export interface TrackedNutrientRow {
  key: string
  name: string
  unit: NutrientUnit
  sortOrder: number
}

export function defaultTrackedNutrients(catalog: NutrientCatalogEntry[]): TrackedNutrientRow[] {
  const byKey = new Map(catalog.map((n) => [n.key, n]))
  return DEFAULT_TRACKED_NUTRIENTS.map((key, sortOrder) => {
    const entry = byKey.get(key)
    if (!entry) throw new Error(`Nutrient ${key} is not seeded`)
    return { key: entry.key, name: entry.name, unit: entry.unit, sortOrder }
  })
}
