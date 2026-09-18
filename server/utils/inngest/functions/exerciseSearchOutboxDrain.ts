import { inngest } from '../client'
import { drainExerciseOutbox } from '../../workouts/searchOutboxDrain'

export const exerciseSearchOutboxDrain = inngest.createFunction(
  { id: 'exercise-search-outbox-drain', triggers: [{ cron: '* * * * *' }] },
  async () => drainExerciseOutbox()
)
