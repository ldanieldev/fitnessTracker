export interface RateRule {
  name: string
  limit: number
  windowSeconds: number
}

export interface RateCount {
  count: number
  resetAt: number
}

export interface RateStore {
  peek: (key: string) => Promise<RateCount | null>
  hit: (key: string, windowMs: number) => Promise<RateCount>
  clear: (key: string) => Promise<void>
}

export interface RedisLike {
  multi: () => {
    set: (key: string, value: number, px: 'PX', ms: number, nx: 'NX') => unknown
    incr: (key: string) => unknown
    get: (key: string) => unknown
    pttl: (key: string) => unknown
    exec: () => Promise<Array<[Error | null, unknown]> | null>
  }
  del: (key: string) => Promise<unknown>
}

const SWEEP_EVERY_MS = 60_000

export function createMemoryStore(now: () => number = Date.now): RateStore & { size: () => number } {
  const entries = new Map<string, RateCount>()
  let nextSweep = now() + SWEEP_EVERY_MS
  const live = (key: string) => {
    const entry = entries.get(key)
    if (entry && entry.resetAt <= now()) {
      entries.delete(key)
      return undefined
    }
    return entry
  }
  // Unique IPs and emails would otherwise pile up for the life of the process.
  const sweep = () => {
    if (now() < nextSweep) return
    nextSweep = now() + SWEEP_EVERY_MS
    for (const [key, entry] of entries) if (entry.resetAt <= now()) entries.delete(key)
  }
  return {
    peek: async (key) => live(key) ?? null,
    hit: async (key, windowMs) => {
      sweep()
      const entry = live(key) ?? { count: 0, resetAt: now() + windowMs }
      entry.count += 1
      entries.set(key, entry)
      return { ...entry }
    },
    clear: async (key) => {
      entries.delete(key)
    },
    size: () => entries.size
  }
}

export function createRedisStore(redis: RedisLike, now: () => number = Date.now): RateStore {
  const results = async (pipeline: ReturnType<RedisLike['multi']>) => {
    const replies = await pipeline.exec()
    if (!replies) throw new Error('rate limit transaction aborted')
    return replies.map(([error, value]) => {
      if (error) throw error
      return value
    })
  }
  return {
    peek: async (key) => {
      const pipeline = redis.multi()
      pipeline.get(key)
      pipeline.pttl(key)
      const [count, ttl] = await results(pipeline)
      if (count === null || Number(ttl) < 0) return null
      return { count: Number(count), resetAt: now() + Number(ttl) }
    },
    hit: async (key, windowMs) => {
      // NX starts the window on the first hit only; INCR keeps that expiry.
      const pipeline = redis.multi()
      pipeline.set(key, 0, 'PX', windowMs, 'NX')
      pipeline.incr(key)
      pipeline.pttl(key)
      const [, count, ttl] = await results(pipeline)
      return { count: Number(count), resetAt: now() + Math.max(Number(ttl), 0) }
    },
    clear: async (key) => {
      await redis.del(key)
    }
  }
}

export function ruleKey(rule: RateRule, id: string) {
  return `ratelimit:${rule.name}:${id}`
}

export function retryAfterSeconds(count: RateCount, now: number) {
  return Math.max(1, Math.ceil((count.resetAt - now) / 1000))
}

// Trusts exactly one proxy hop: the rightmost entry is the one our proxy appended, the rest are client-supplied.
export function forwardedClientIp(header: string | undefined): string | undefined {
  const last = header?.split(',').pop()?.trim()
  return last || undefined
}
