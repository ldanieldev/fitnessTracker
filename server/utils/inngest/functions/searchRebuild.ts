import { inngest } from '../client'
import { runSearchRebuild } from '../../nutrition/searchRebuild'

export const searchRebuild = inngest.createFunction(
  { id: 'search-rebuild', triggers: [{ event: 'search/rebuild.requested' }] },
  async () => runSearchRebuild()
)
