import { drainOutbox, type OutboxDrainResult } from '../search/outboxDrain'
import { ExerciseMeiliProvider } from './meiliSearch'
import { getExerciseSearchProvider, isDegradedExerciseProvider } from './searchProvider'

export async function drainExerciseOutbox(limit = 500): Promise<OutboxDrainResult> {
  const provider = await getExerciseSearchProvider()
  if (isDegradedExerciseProvider(provider)) return { processed: 0, failed: 0, skipped: true, rebuilt: false }
  const isEmpty = provider instanceof ExerciseMeiliProvider ? () => provider.isEmpty() : undefined
  return drainOutbox('exercise', provider, { isEmpty }, limit)
}
