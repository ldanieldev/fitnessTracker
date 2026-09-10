import { inngest } from '../client'
import { runSearchRebuild } from '../../nutrition/searchRebuild'

export const searchNightlyRebuild = inngest.createFunction(
  { id: 'search-nightly-rebuild', triggers: [{ cron: '0 3 * * *' }] },
  async () => runSearchRebuild()
)
