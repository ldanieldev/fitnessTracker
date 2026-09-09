import type { DbClient } from '../db'
import { loadFood, type LoadedFood } from './loadFood'

export async function loadEditableFood(client: DbClient, userId: number, foodId: number): Promise<LoadedFood> {
  const food = await loadFood(client, userId, foodId)
  if (!food) throw createError({ statusCode: 404, statusMessage: 'Food not found' })
  if (food.createdByUserId === null) {
    throw createError({ statusCode: 403, statusMessage: 'Fork this food before editing it' })
  }
  return food
}
