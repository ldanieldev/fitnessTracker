import { getSearchProvider, isDegradedProvider } from './searchProvider'

export async function runSearchRebuild(): Promise<{ skipped: boolean }> {
  const provider = await getSearchProvider()
  if (isDegradedProvider(provider)) return { skipped: true }
  await provider.rebuild()
  return { skipped: false }
}
