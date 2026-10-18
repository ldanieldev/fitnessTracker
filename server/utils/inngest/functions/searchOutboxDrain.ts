import { inngest } from '../client'
import { drainSearchOutbox } from '../../nutrition/searchOutboxDrain'

export const searchOutboxDrain = inngest.createFunction(
  { id: 'search-outbox-drain', singleton: { mode: 'skip' }, triggers: [{ cron: '* * * * *' }] },
  async () => drainSearchOutbox()
)
