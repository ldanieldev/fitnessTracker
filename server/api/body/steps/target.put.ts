import type { StepTarget } from '~~/shared/types/steps'
import { stepTargets } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { stepTargetPutSchema } from '~~/server/utils/body/input'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event): Promise<StepTarget> => {
  const userId = await requireUserId(event)
  const { dailyTarget, effectiveFrom } = await parseBody(event, stepTargetPutSchema)
  const row = await db
    .insert(stepTargets)
    .values({ userId, dailyTarget, effectiveFrom })
    .onConflictDoUpdate({
      target: [stepTargets.userId, stepTargets.effectiveFrom],
      set: { dailyTarget, updatedAt: new Date() }
    })
    .returning()
    .then((r) => r[0]!)
  return { dailyTarget: row.dailyTarget, effectiveFrom: row.effectiveFrom }
})
