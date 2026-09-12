export type CacheMountOutcome = 'memory' | 'redis'

// Kept free of Nitro globals (useStorage, redisDriver/ioredis) so it runs under plain vitest; the caller owns the probe's driver.
export async function resolveRedisCache(
  url: string | undefined,
  probe: () => Promise<void>,
  log: (message: string) => void
): Promise<CacheMountOutcome> {
  if (!url) return 'memory'
  try {
    await probe()
    return 'redis'
  } catch {
    log(`[cache] Redis unreachable at ${redisHost(url)}; using the in-memory cache`)
    return 'memory'
  }
}

function redisHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
