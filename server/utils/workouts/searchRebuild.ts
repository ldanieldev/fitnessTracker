import { getExerciseSearchProvider, isDegradedExerciseProvider } from './searchProvider'

export async function runExerciseSearchRebuild(): Promise<{ skipped: boolean }> {
  const provider = await getExerciseSearchProvider()
  if (isDegradedExerciseProvider(provider)) return { skipped: true }
  await provider.rebuild()
  return { skipped: false }
}
