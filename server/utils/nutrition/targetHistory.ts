import { and, asc, desc, eq, isNull, lt } from 'drizzle-orm'
import { z } from 'zod'
import { goalProfiles, goalProfileTargets, goalTargetHistory, nutrients } from '~~/server/db/schema'
import type { GoalTargetSnapshot } from '~~/server/db/schema'
import { db, type DbClient } from '~~/server/utils/db'
import { isoDate } from '~~/server/utils/body/input'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { todayDate } from '~~/shared/utils/nutritionSummary'
import type { H3Event } from 'h3'

export interface DefaultTargets {
  effectiveFrom: string
  profileId: number | null
  profileName: string | null
  calories: number | null
  targets: GoalTargetSnapshot[]
}

const effectiveQuerySchema = z.object({ today: isoDate.optional() })

/** The client's date for a goal-profile change, so a late-evening edit lands on the user's day, not UTC's. */
export function changeDate(event: H3Event): string {
  return parseQuery(event, effectiveQuerySchema).today ?? todayDate()
}

async function currentDefault(client: DbClient, userId: number): Promise<Omit<DefaultTargets, 'effectiveFrom'>> {
  const profile = await client
    .select({ id: goalProfiles.id, name: goalProfiles.name, calories: goalProfiles.calories })
    .from(goalProfiles)
    .where(and(eq(goalProfiles.userId, userId), eq(goalProfiles.isDefault, true), isNull(goalProfiles.deletedAt)))
    .then((r) => r[0])
  if (!profile) return { profileId: null, profileName: null, calories: null, targets: [] }
  const targets = await client
    .select({ key: nutrients.key, amount: goalProfileTargets.amount, direction: goalProfileTargets.direction })
    .from(goalProfileTargets)
    .innerJoin(nutrients, eq(nutrients.id, goalProfileTargets.nutrientId))
    .where(eq(goalProfileTargets.profileId, profile.id))
    .orderBy(asc(nutrients.key))
  return {
    profileId: profile.id,
    profileName: profile.name,
    calories: profile.calories === null ? null : Number(profile.calories),
    targets: targets.map((t) => ({ key: t.key, amount: Number(t.amount), direction: t.direction }))
  }
}

const sameSnapshot = (a: Omit<DefaultTargets, 'effectiveFrom'>, b: Omit<DefaultTargets, 'effectiveFrom'>) =>
  JSON.stringify([a.profileId, a.profileName, a.calories, a.targets]) ===
  JSON.stringify([b.profileId, b.profileName, b.calories, b.targets])

/**
 * Records the default profile's targets as of `effectiveFrom`. Same-day changes overwrite one entry, and a change
 * that ends up matching the entry before it removes the day's entry instead of storing a duplicate.
 */
export async function recordDefaultTargets(client: DbClient, userId: number, effectiveFrom: string): Promise<void> {
  const current = await currentDefault(client, userId)
  const previous = await client
    .select()
    .from(goalTargetHistory)
    .where(and(eq(goalTargetHistory.userId, userId), lt(goalTargetHistory.effectiveFrom, effectiveFrom)))
    .orderBy(desc(goalTargetHistory.effectiveFrom))
    .limit(1)
    .then((r) => r[0])
  const unchanged = previous
    ? sameSnapshot(current, {
        profileId: previous.profileId,
        profileName: previous.profileName,
        calories: previous.calories === null ? null : Number(previous.calories),
        targets: previous.targets
      })
    : current.profileId === null
  const today = and(eq(goalTargetHistory.userId, userId), eq(goalTargetHistory.effectiveFrom, effectiveFrom))
  if (unchanged) {
    await client.delete(goalTargetHistory).where(today)
    return
  }
  const values = {
    profileId: current.profileId,
    profileName: current.profileName,
    calories: current.calories === null ? null : String(current.calories),
    targets: current.targets
  }
  await client
    .insert(goalTargetHistory)
    .values({ userId, effectiveFrom, ...values })
    .onConflictDoUpdate({
      target: [goalTargetHistory.userId, goalTargetHistory.effectiveFrom],
      set: { ...values, updatedAt: new Date() }
    })
}

export async function loadDefaultHistory(userId: number, client: DbClient = db): Promise<DefaultTargets[]> {
  const rows = await client
    .select()
    .from(goalTargetHistory)
    .where(eq(goalTargetHistory.userId, userId))
    .orderBy(asc(goalTargetHistory.effectiveFrom))
  return rows.map((r) => ({
    effectiveFrom: r.effectiveFrom,
    profileId: r.profileId,
    profileName: r.profileName,
    calories: r.calories === null ? null : Number(r.calories),
    targets: r.targets
  }))
}
