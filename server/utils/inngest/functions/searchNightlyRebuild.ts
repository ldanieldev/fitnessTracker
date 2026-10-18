import { logger } from '../../logger'
import { inngest } from '../client'
import { runSearchRebuild } from '../../nutrition/searchRebuild'
import { runExerciseSearchRebuild } from '../../workouts/searchRebuild'

function outcome(index: 'food' | 'exercise', result: PromiseSettledResult<{ skipped: boolean }>) {
  if (result.status === 'fulfilled') {
    if (result.value.skipped) logger.warn({ index }, 'nightly search rebuild skipped: Meilisearch unavailable')
    return { ok: true, skipped: result.value.skipped }
  }
  logger.error({ err: result.reason, index }, 'nightly search rebuild failed')
  return { ok: false, error: String(result.reason) }
}

export const searchNightlyRebuild = inngest.createFunction(
  { id: 'search-nightly-rebuild', triggers: [{ cron: '0 3 * * *' }] },
  async () => {
    // allSettled, not all: a Meilisearch failure rebuilding one index must not skip the other index's nightly rebuild.
    const [food, exercise] = await Promise.allSettled([runSearchRebuild(), runExerciseSearchRebuild()])
    return { food: outcome('food', food), exercise: outcome('exercise', exercise) }
  }
)
