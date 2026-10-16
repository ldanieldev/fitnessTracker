import { pushWeight, type WeightChange } from '../../googleHealth/weightPush'
import { inngest } from '../client'

export const googleHealthWeightPush = inngest.createFunction(
  {
    id: 'google-health-weight-push',
    triggers: [{ event: 'google-health/weight.changed' }],
    concurrency: { key: 'event.data.userId', limit: 1 },
    retries: 3
  },
  async ({ event }) => pushWeight(event.data as WeightChange)
)
