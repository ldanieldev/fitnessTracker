import { inngest } from '../client'
import { runExerciseSearchRebuild } from '../../workouts/searchRebuild'

export const exerciseSearchRebuild = inngest.createFunction(
  { id: 'exercise-search-rebuild', triggers: [{ event: 'exercise-search/rebuild.requested' }] },
  async () => runExerciseSearchRebuild()
)
