import { inngest } from '../client'
import { runSearchRebuild } from '../../nutrition/searchRebuild'
import { runExerciseSearchRebuild } from '../../workouts/searchRebuild'

function outcome(result: PromiseSettledResult<{ skipped: boolean }>) {
  if (result.status === 'fulfilled') return { ok: true, skipped: result.value.skipped }
  return { ok: false, error: String(result.reason) }
}

export const searchNightlyRebuild = inngest.createFunction(
  { id: 'search-nightly-rebuild', triggers: [{ cron: '0 3 * * *' }] },
  async () => {
    // allSettled, not all: a Meilisearch failure rebuilding one index must not skip the other index's nightly rebuild.
    const [food, exercise] = await Promise.allSettled([runSearchRebuild(), runExerciseSearchRebuild()])
    return { food: outcome(food), exercise: outcome(exercise) }
  }
)
