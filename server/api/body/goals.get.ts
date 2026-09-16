import type { GoalOverview } from '~~/shared/types/body'
import { toEntry } from '~~/server/utils/body/entries'
import { latestReading, loadGoals } from '~~/server/utils/body/goals'
import { listTypesForUser } from '~~/server/utils/body/types'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event): Promise<GoalOverview[]> => {
  const userId = await requireUserId(event)
  const types = await listTypesForUser(userId, { includeHidden: true })
  const goals = await loadGoals(userId, types.map((t) => t.id))
  const out: GoalOverview[] = []
  for (const type of types) {
    const goal = goals.get(type.id)
    if (!goal) continue
    const latest = await latestReading(userId, type.id)
    out.push({ type, goal, latest: latest ? toEntry(latest) : null })
  }
  return out
})
