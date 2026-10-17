import { inngest } from '../client'
import { rebuildUserRollups, rollupUserIds } from '../../workouts/rollups'

const USERS_PER_STEP = 50

export const rollupNightlyRebuild = inngest.createFunction(
  { id: 'workout-rollup-nightly-rebuild', triggers: [{ cron: '20 3 * * *' }] },
  async ({ step }) => {
    const userIds = await step.run('list-users', () => rollupUserIds())
    let rows = 0
    for (let i = 0; i < userIds.length; i += USERS_PER_STEP) {
      const batch = userIds.slice(i, i + USERS_PER_STEP)
      rows += await step.run(`rebuild-users-${batch[0]}-${batch.at(-1)}`, async () => {
        let batchRows = 0
        for (const userId of batch) batchRows += (await rebuildUserRollups(userId)).rows
        return batchRows
      })
    }
    return { users: userIds.length, rows }
  }
)
