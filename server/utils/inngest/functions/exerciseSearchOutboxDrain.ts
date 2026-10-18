import { inngest } from '../client'
import { drainExerciseOutbox } from '../../workouts/searchOutboxDrain'

export const exerciseSearchOutboxDrain = inngest.createFunction(
  { id: 'exercise-search-outbox-drain', singleton: { mode: 'skip' }, triggers: [{ cron: '* * * * *' }] },
  async () => drainExerciseOutbox()
)
