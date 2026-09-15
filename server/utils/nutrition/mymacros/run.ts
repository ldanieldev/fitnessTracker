import { and, eq, isNull, max } from 'drizzle-orm'
import { diaryEntries, foodNutrients, foods, foodServings, foodSources, importJobs, mealContainers } from '~~/server/db/schema'
import type { ImportResult, ImportWarning } from '~~/shared/types/nutrition'
import type { RootDbClient } from '../../db'
import { inngest } from '../../inngest/client'
import { isUniqueViolation } from '../../pgError'
import { createFoodRecord } from '../createFood'
import { ensureDay } from '../day'
import { writeEntry } from '../entry'
import { buildServingRows, type ServingInput } from '../foodInput'
import { insertOrRecover } from '../importFood'
import { nutrientIdMap } from '../nutrientIds'
import { enqueueSearchOutbox } from '../searchOutbox'
import { MyMacrosParseError, parseMyMacrosExport, type ParsedDay } from './parse'
import { planImport, type PlannedEntry, type PlannedFood } from './plan'

const NUTRIENT_KEYS = { energy: 'energy', protein: 'protein', carbohydrate: 'carbohydrate', fat: 'fat' } as const

export function toServingInputs(
  food: PlannedFood,
  nutrientKeys: { energy: string, protein: string, carbohydrate: string, fat: string }
): ServingInput[] {
  return food.servings.map((serving) => ({
    kind: serving.kind,
    label: serving.label,
    quantity: serving.quantity,
    basisGrams: serving.basisGrams,
    nutrients: {
      [nutrientKeys.energy]: serving.perUnit.kcal,
      [nutrientKeys.protein]: serving.perUnit.protein,
      [nutrientKeys.carbohydrate]: serving.perUnit.carbs,
      [nutrientKeys.fat]: serving.perUnit.fat
    }
  }))
}

async function lookupOwnedFood(db: RootDbClient, userId: number, sourceId: number, externalId: string) {
  return db
    .select({ id: foods.id })
    .from(foods)
    .where(
      and(eq(foods.createdByUserId, userId), eq(foods.sourceId, sourceId), eq(foods.externalId, externalId), isNull(foods.deletedAt))
    )
    .limit(1)
    .then((r) => r[0] ?? null)
}

async function selectLiveServings(db: RootDbClient, foodId: number) {
  return db
    .select({ id: foodServings.id, label: foodServings.label, kind: foodServings.kind })
    .from(foodServings)
    .where(and(eq(foodServings.foodId, foodId), isNull(foodServings.deletedAt)))
}

async function addMissingServings(db: RootDbClient, foodId: number, missing: PlannedFood, nutrientIds: Map<string, number>) {
  const inputs = toServingInputs(missing, NUTRIENT_KEYS)
  const prepared = buildServingRows(inputs, nutrientIds).map((s) => ({ ...s, origin: 'import' as const }))

  await db.transaction(async (tx) => {
    const currentMax = await tx
      .select({ max: max(foodServings.sortOrder) })
      .from(foodServings)
      .where(and(eq(foodServings.foodId, foodId), isNull(foodServings.deletedAt)))
      .then((r) => r[0]?.max ?? -1)

    for (const [index, serving] of prepared.entries()) {
      const row = await tx
        .insert(foodServings)
        .values({
          foodId,
          kind: serving.kind,
          label: serving.label,
          quantity: String(serving.quantity),
          basisGrams: serving.basisGrams === null ? null : String(serving.basisGrams),
          hasOwnNutrition: serving.hasOwnNutrition,
          origin: serving.origin,
          sortOrder: currentMax + 1 + index
        })
        .returning({ id: foodServings.id })
        .then((r) => r[0]!)

      if (serving.nutrients.length) {
        await tx
          .insert(foodNutrients)
          .values(serving.nutrients.map((n) => ({ foodServingId: row.id, nutrientId: n.nutrientId, amount: String(n.amount) })))
      }
    }

    await enqueueSearchOutbox(tx, foodId, 'upsert')
  })
}

// meal_container_user_name_unique keeps this get-or-create correct if two imports race.
async function ensureContainer(db: RootDbClient, userId: number, name: string): Promise<{ id: number, created: boolean }> {
  const existing = await db
    .select({ id: mealContainers.id })
    .from(mealContainers)
    .where(and(eq(mealContainers.userId, userId), eq(mealContainers.name, name)))
    .then((r) => r[0])
  if (existing) return { id: existing.id, created: false }

  const highest = await db
    .select({ max: max(mealContainers.sortOrder) })
    .from(mealContainers)
    .where(eq(mealContainers.userId, userId))
    .then((r) => r[0]?.max ?? -1)

  try {
    const created = await db
      .insert(mealContainers)
      .values({ userId, name, sortOrder: highest + 1 })
      .returning({ id: mealContainers.id })
      .then((r) => r[0]!)
    return { id: created.id, created: true }
  } catch (err) {
    if (!isUniqueViolation(err, 'meal_container_user_name_unique')) throw err
    const recovered = await db
      .select({ id: mealContainers.id })
      .from(mealContainers)
      .where(and(eq(mealContainers.userId, userId), eq(mealContainers.name, name)))
      .then((r) => r[0]!)
    return { id: recovered.id, created: false }
  }
}

async function performImport(db: RootDbClient, userId: number, payload: Array<{ name: string, text: string }>): Promise<ImportResult> {
  const failedFiles: Array<{ fileName: string, error: string }> = []
  const parsed: ParsedDay[] = []
  const indexByDate = new Map<string, number>()
  const warnings: ImportWarning[] = []

  for (const file of payload) {
    let day: ParsedDay
    try {
      day = parseMyMacrosExport(file.text, file.name)
    } catch (err) {
      if (!(err instanceof MyMacrosParseError)) throw err
      failedFiles.push({ fileName: file.name, error: err.message })
      continue
    }
    const existingIndex = indexByDate.get(day.date)
    if (existingIndex !== undefined) {
      warnings.push({ date: day.date, code: 'duplicate_date', message: `Duplicate date ${day.date}; keeping ${file.name}` })
      parsed[existingIndex] = day
    } else {
      indexByDate.set(day.date, parsed.length)
      parsed.push(day)
    }
  }

  const plan = planImport(parsed, userId)
  warnings.push(...plan.warnings)

  const nutrientIds = await nutrientIdMap()
  const energyId = nutrientIds.get('energy')!
  const proteinId = nutrientIds.get('protein')!
  const carbId = nutrientIds.get('carbohydrate')!
  const fatId = nutrientIds.get('fat')!

  const mymacrosSource = await db.select({ id: foodSources.id }).from(foodSources).where(eq(foodSources.key, 'mymacros')).then((r) => r[0])
  if (!mymacrosSource) throw new Error('food_sources row for mymacros is missing — run migrations')

  let foodsCreated = 0
  let foodsReused = 0
  const foodIdByKey = new Map<string, number>()
  const servingIdByLabelByFoodKey = new Map<string, Map<string, number>>()

  for (const food of plan.foods) {
    const existing = await lookupOwnedFood(db, userId, mymacrosSource.id, food.key)
    let foodId: number

    if (existing) {
      foodsReused++
      foodId = existing.id
      const liveServings = await selectLiveServings(db, foodId)
      const liveLabels = new Set(liveServings.map((s) => s.label))
      const hasWeight = liveServings.some((s) => s.kind === 'weight')
      const missingServings = food.servings.filter((s) => !liveLabels.has(s.label) && !(s.kind === 'weight' && hasWeight))
      if (missingServings.length) {
        await addMissingServings(db, foodId, { ...food, servings: missingServings }, nutrientIds)
      }
    } else {
      const inputs = toServingInputs(food, NUTRIENT_KEYS)
      const prepared = buildServingRows(inputs, nutrientIds).map((s) => ({ ...s, origin: 'import' as const }))
      const created = await insertOrRecover(
        db,
        (tx) =>
          createFoodRecord(tx, {
            ownerId: userId,
            sourceId: mymacrosSource.id,
            externalId: food.key,
            barcode: null,
            name: food.name,
            brand: null,
            prepared
          }),
        () => lookupOwnedFood(db, userId, mymacrosSource.id, food.key)
      )
      foodId = created.id
      foodsCreated++
    }

    const liveServings = await selectLiveServings(db, foodId)
    foodIdByKey.set(food.key, foodId)
    servingIdByLabelByFoodKey.set(food.key, new Map(liveServings.map((s) => [s.label, s.id])))
  }

  let containersCreated = 0
  const containerIdByName = new Map<string, number>()
  for (const name of plan.containers) {
    const container = await ensureContainer(db, userId, name)
    containerIdByName.set(name, container.id)
    if (container.created) containersCreated++
  }

  let entriesInserted = 0
  let entriesSkipped = 0
  const entriesByDate = new Map<string, PlannedEntry[]>()
  for (const entry of plan.entries) {
    const forDate = entriesByDate.get(entry.date) ?? []
    forDate.push(entry)
    entriesByDate.set(entry.date, forDate)
  }

  for (const [date, dayEntries] of entriesByDate) {
    await db.transaction(async (tx) => {
      const day = await ensureDay(tx, userId, date)
      const nextSortOrder = new Map<number, number>()

      for (const entry of dayEntries) {
        const existingEntry = await tx
          .select({ id: diaryEntries.id })
          .from(diaryEntries)
          .where(eq(diaryEntries.importKey, entry.importKey))
          .limit(1)
          .then((r) => r[0])
        if (existingEntry) {
          entriesSkipped++
          continue
        }

        const containerId = containerIdByName.get(entry.container)!
        const cached = nextSortOrder.get(containerId)
        const sortOrder = cached === undefined
          ? await tx
              .select({ max: max(diaryEntries.sortOrder) })
              .from(diaryEntries)
              .where(and(eq(diaryEntries.dayId, day.id), eq(diaryEntries.containerId, containerId)))
              .then((r) => (r[0]?.max ?? -1) + 1)
          : cached
        nextSortOrder.set(containerId, sortOrder + 1)

        const foodId = entry.kind === 'food' ? foodIdByKey.get(entry.foodKey!)! : null
        const foodServingId = entry.kind === 'food' && entry.servingLabel
          ? servingIdByLabelByFoodKey.get(entry.foodKey!)?.get(entry.servingLabel) ?? null
          : null

        await writeEntry(tx, {
          dayId: day.id,
          containerId,
          sortOrder,
          entryType: entry.kind,
          quantity: entry.quantity,
          unitLabel: entry.unitLabel,
          gramsResolved: entry.gramsResolved,
          foodId,
          foodServingId,
          description: entry.description,
          loggedAt: new Date(`${entry.date}T00:00:00Z`),
          importKey: entry.importKey,
          nutrients: {
            [energyId]: entry.nutrients.kcal,
            [proteinId]: entry.nutrients.protein,
            [carbId]: entry.nutrients.carbs,
            [fatId]: entry.nutrients.fat
          }
        })
        entriesInserted++
      }
    })
  }

  if (foodsCreated > 0) {
    try {
      await inngest.send({ name: 'search/rebuild.requested', data: { userId } })
    } catch (err) {
      // The nightly rebuild (search-nightly-rebuild) covers this if the dev Inngest server is unreachable.
      console.warn('inngest.send failed for search/rebuild.requested', err)
    }
  }

  return {
    days: parsed.length,
    entries: entriesInserted,
    entriesSkipped,
    foodsCreated,
    foodsReused,
    containersCreated,
    warnings,
    failedFiles
  }
}

export async function runMyMacrosImport(db: RootDbClient, jobId: number): Promise<ImportResult> {
  const job = await db.select().from(importJobs).where(eq(importJobs.id, jobId)).then((r) => r[0])
  if (!job) throw new Error(`Import job ${jobId} not found`)

  await db.update(importJobs).set({ status: 'running' }).where(eq(importJobs.id, jobId))

  try {
    const result = await performImport(db, job.userId, job.payload as Array<{ name: string, text: string }>)
    await db.update(importJobs).set({ status: 'done', result }).where(eq(importJobs.id, jobId))
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.update(importJobs).set({ status: 'failed', error: message }).where(eq(importJobs.id, jobId))
    throw err
  }
}
