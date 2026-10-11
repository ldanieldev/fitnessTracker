import type { DashboardPart } from '~~/shared/types/dashboard'
import { dashboardCacheKey } from '~~/shared/utils/dashboard'
import { readStamped, type StampedEntry } from '~~/server/utils/cache/stampedCache'
import type { DashboardContext } from '~~/server/utils/dashboard/context'

const MAX_AGE = 60 * 60 * 24

export async function cachedPart<T>(
  part: DashboardPart,
  ctx: DashboardContext,
  stamp: () => Promise<unknown>,
  compute: () => Promise<T>
): Promise<T> {
  const storage = useStorage('cache')
  return readStamped<T>(
    {
      get: (key) => storage.getItem<StampedEntry<T>>(key),
      set: (key, entry, ttl) => storage.setItem(key, entry, { ttl })
    },
    dashboardCacheKey(part, ctx.userId, ctx.today, ctx.weekStart),
    JSON.stringify(await stamp()),
    MAX_AGE,
    compute
  )
}
