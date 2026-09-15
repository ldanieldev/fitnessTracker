import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { TargetDirection } from '~~/shared/types/nutrition'
import { goalProfiles, goalProfileTargets, nutrients } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/session'

interface EchoedTarget {
  nutrient: string
  amount: number
  direction: TargetDirection
  ratioPercent: number | null
}

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const profiles = await db
    .select({
      id: goalProfiles.id,
      name: goalProfiles.name,
      inputMode: goalProfiles.inputMode,
      calories: goalProfiles.calories,
      isDefault: goalProfiles.isDefault
    })
    .from(goalProfiles)
    .where(and(eq(goalProfiles.userId, userId), isNull(goalProfiles.deletedAt)))
    .orderBy(desc(goalProfiles.isDefault), asc(goalProfiles.id))

  const profileIds = profiles.map((p) => p.id)

  const targetRows = profileIds.length
    ? await db
      .select({
        profileId: goalProfileTargets.profileId,
        nutrient: nutrients.key,
        amount: goalProfileTargets.amount,
        direction: goalProfileTargets.direction,
        ratioPercent: goalProfileTargets.ratioPercent
      })
      .from(goalProfileTargets)
      .innerJoin(nutrients, eq(nutrients.id, goalProfileTargets.nutrientId))
      .where(inArray(goalProfileTargets.profileId, profileIds))
    : []

  const targetsByProfile = new Map<number, EchoedTarget[]>()
  for (const row of targetRows) {
    const list = targetsByProfile.get(row.profileId) ?? []
    list.push({
      nutrient: row.nutrient,
      amount: Number(row.amount),
      direction: row.direction,
      ratioPercent: row.ratioPercent === null ? null : Number(row.ratioPercent)
    })
    targetsByProfile.set(row.profileId, list)
  }

  return profiles.map((p) => ({
    id: p.id,
    name: p.name,
    inputMode: p.inputMode,
    calories: p.calories === null ? null : Number(p.calories),
    isDefault: p.isDefault,
    targets: targetsByProfile.get(p.id) ?? []
  }))
})
