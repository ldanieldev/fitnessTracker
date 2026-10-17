import { inngest } from '../client'
import { rebuildUserRollups, rollupUserIds } from '../../workouts/rollups'

export const rollupNightlyRebuild = inngest.createFunction(
  { id: 'workout-rollup-nightly-rebuild', triggers: [{ cron: '20 3 * * *' }] },
  async ({ step }) => {
    const userIds = await step.run('list-users', () => rollupUserIds())
    let rows = 0
    for (const userId of userIds) {
      rows += (await step.run(`rebuild-user-${userId}`, () => rebuildUserRollups(userId))).rows
    }
    return { users: userIds.length, rows }
  }
)
