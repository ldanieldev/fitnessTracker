import { foodNutrients, foods, foodServings } from '~~/server/db/schema'
import type { DbClient } from '../db'
import type { PreparedServing } from './foodInput'
import { enqueueSearchOutbox } from './searchOutbox'

export interface CreateFoodArgs {
  ownerId: number | null
  sourceId: number | null
  externalId: string | null
  barcode: string | null
  name: string
  brand: string | null
  prepared: PreparedServing[]
}

export async function createFoodRecord(tx: DbClient, args: CreateFoodArgs): Promise<{ id: number }> {
  const food = await tx
    .insert(foods)
    .values({
      name: args.name,
      brand: args.brand,
      barcode: args.barcode,
      createdByUserId: args.ownerId,
      sourceId: args.sourceId,
      externalId: args.externalId
    })
    .returning()
    .then((r) => r[0]!)

  for (const serving of args.prepared) {
    const row = await tx
      .insert(foodServings)
      .values({
        foodId: food.id,
        kind: serving.kind,
        label: serving.label,
        quantity: String(serving.quantity),
        basisGrams: serving.basisGrams === null ? null : String(serving.basisGrams),
        hasOwnNutrition: serving.hasOwnNutrition,
        origin: serving.origin,
        sortOrder: serving.sortOrder
      })
      .returning()
      .then((r) => r[0]!)

    if (serving.nutrients.length) {
      await tx.insert(foodNutrients).values(
        serving.nutrients.map((n) => ({
          foodServingId: row.id,
          nutrientId: n.nutrientId,
          amount: String(n.amount)
        }))
      )
    }
  }

  await enqueueSearchOutbox(tx, food.id, 'upsert')

  return { id: food.id }
}
