import { inngest } from '../client'
import { drainSearchOutbox } from '../../nutrition/searchOutboxDrain'

export const searchOutboxDrain = inngest.createFunction(
  { id: 'search-outbox-drain', triggers: [{ cron: '* * * * *' }] },
  async () => drainSearchOutbox()
)
