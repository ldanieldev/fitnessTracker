import { searchOutbox } from '~~/server/db/schema'
import type { DbClient } from '../db'

export async function enqueueExerciseOutbox(tx: DbClient, exerciseId: number, op: 'upsert' | 'delete') {
  await tx.insert(searchOutbox).values({ entity: 'exercise', entityId: exerciseId, op })
}
