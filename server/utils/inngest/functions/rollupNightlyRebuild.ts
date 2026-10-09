import { inngest } from '../client'
import { rebuildRollups } from '../../workouts/rollups'

export const rollupNightlyRebuild = inngest.createFunction(
  { id: 'workout-rollup-nightly-rebuild', triggers: [{ cron: '20 3 * * *' }] },
  async () => rebuildRollups()
)
