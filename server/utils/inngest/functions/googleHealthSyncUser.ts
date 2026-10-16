import { runSyncJob } from '../../googleHealth/sync'
import { inngest } from '../client'

export const googleHealthSyncUser = inngest.createFunction(
  {
    id: 'google-health-sync-user',
    triggers: [{ event: 'google-health/sync.requested' }],
    concurrency: { key: 'event.data.userId', limit: 1 },
    retries: 3
  },
  async ({ event }) => runSyncJob(event.data.userId, { full: event.data.full === true })
)
