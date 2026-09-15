import { searchOutbox } from '~~/server/db/schema'
import type { DbClient } from '../db'

export async function enqueueSearchOutbox(tx: DbClient, foodId: number, op: 'upsert' | 'delete') {
  await tx.insert(searchOutbox).values({ entity: 'food', entityId: foodId, op })
}
