import type { Driver } from 'unstorage'

const COMMAND_ERROR_LOG_INTERVAL_MS = 60_000

export interface CacheLog {
  warn: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
}

/** Capped backoff for ioredis reconnects: retries forever, at most every 5 s. */
export function redisRetryDelay(attempt: number): number {
  return Math.min(attempt * 250, 5000)
}

export function redisHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * Routes cache calls to `primary` while `isUp()` and to `fallback` otherwise, so a Redis outage costs hit rate rather
 * than an error per cache read. A command that fails while Redis looks up is reported and retried on the fallback.
 */
export function withFallback(
  primary: Driver,
  fallback: Driver,
  isUp: () => boolean,
  onError: (error: unknown) => void
): Driver {
  const route = async <T>(op: (driver: Driver) => T | Promise<T>): Promise<T> => {
    if (isUp()) {
      try {
        return await op(primary)
      } catch (error) {
        onError(error)
      }
    }
    return op(fallback)
  }
  return {
    name: primary.name,
    options: primary.options,
    getInstance: primary.getInstance,
    hasItem: (key, opts) => route((d) => d.hasItem(key, opts)),
    getItem: (key, opts) => route((d) => d.getItem(key, opts)),
    setItem: (key, value, opts) => route((d) => d.setItem?.(key, value, opts)),
    removeItem: (key, opts) => route((d) => d.removeItem?.(key, opts)),
    getKeys: (base, opts) => route((d) => d.getKeys(base, opts)),
    clear: (base, opts) => route((d) => d.clear?.(base, opts)),
    dispose: async () => {
      await primary.dispose?.()
      await fallback.dispose?.()
    }
  }
}

/** Logs a Redis outage once when it starts and once when it ends, however many reconnect attempts fail between. */
export function outageTracker(host: string, log: CacheLog, now: () => number = Date.now) {
  let connected = false
  let down = false
  let lastCommandLog = -Infinity
  return {
    ready() {
      if (down) log.info(`[cache] Redis at ${host} is back; using it again`)
      else if (!connected) log.info('[cache] Redis cache mounted')
      connected = true
      down = false
    },
    lost() {
      if (down) return
      down = true
      log.warn(`[cache] Redis unreachable at ${host}; using the in-memory cache until it reconnects`)
    },
    commandFailed(error: unknown) {
      if (now() - lastCommandLog < COMMAND_ERROR_LOG_INTERVAL_MS) return
      lastCommandLog = now()
      log.warn('[cache] Redis command failed; served from the in-memory cache', error)
    }
  }
}
