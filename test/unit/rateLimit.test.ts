import { describe, expect, it } from 'vitest'
import {
  createMemoryStore,
  createRedisStore,
  forwardedClientIp,
  retryAfterSeconds,
  ruleKey,
  type RedisLike
} from '../../server/utils/rateLimit/store'

function fakeRedis(clock: { now: number }) {
  const data = new Map<string, { value: number; expiresAt: number }>()
  const alive = (key: string) => {
    const entry = data.get(key)
    if (entry && entry.expiresAt <= clock.now) data.delete(key)
    return data.get(key)
  }
  const redis: RedisLike = {
    multi: () => {
      const ops: Array<() => unknown> = []
      const pipeline = {
        set: (key: string, value: number, _px: 'PX', ms: number) => {
          ops.push(() => (alive(key) ? null : data.set(key, { value, expiresAt: clock.now + ms }) && 'OK'))
        },
        incr: (key: string) => {
          ops.push(() => {
            const entry = alive(key) ?? { value: 0, expiresAt: Number.POSITIVE_INFINITY }
            entry.value += 1
            data.set(key, entry)
            return entry.value
          })
        },
        get: (key: string) => {
          ops.push(() => (alive(key) ? String(alive(key)!.value) : null))
        },
        pttl: (key: string) => {
          ops.push(() => (alive(key) ? alive(key)!.expiresAt - clock.now : -2))
        },
        exec: async () => ops.map((op) => [null, op()] as [null, unknown])
      }
      return pipeline
    },
    del: async (key: string) => data.delete(key)
  }
  return redis
}

const stores = {
  memory: (clock: { now: number }) => createMemoryStore(() => clock.now),
  redis: (clock: { now: number }) => createRedisStore(fakeRedis(clock), () => clock.now)
}

describe.each(Object.entries(stores))('%s rate store', (_name, make) => {
  it('counts hits inside one fixed window and reports when it resets', async () => {
    const clock = { now: 1_000 }
    const store = make(clock)
    expect(await store.peek('k')).toBeNull()
    expect(await store.hit('k', 60_000)).toEqual({ count: 1, resetAt: 61_000 })
    clock.now = 31_000
    expect(await store.hit('k', 60_000)).toEqual({ count: 2, resetAt: 61_000 })
    expect(await store.peek('k')).toEqual({ count: 2, resetAt: 61_000 })
  })

  it('starts a fresh window once the old one expires', async () => {
    const clock = { now: 0 }
    const store = make(clock)
    await store.hit('k', 1_000)
    await store.hit('k', 1_000)
    clock.now = 1_000
    expect(await store.peek('k')).toBeNull()
    expect(await store.hit('k', 1_000)).toEqual({ count: 1, resetAt: 2_000 })
  })

  it('clears a key', async () => {
    const clock = { now: 0 }
    const store = make(clock)
    await store.hit('k', 1_000)
    await store.clear('k')
    expect(await store.peek('k')).toBeNull()
  })
})

describe('memory rate store', () => {
  it('sweeps expired keys so unique ids do not accumulate', async () => {
    const clock = { now: 0 }
    const store = createMemoryStore(() => clock.now)
    for (let i = 0; i < 100; i++) await store.hit(`ip-${i}`, 1_000)
    expect(store.size()).toBe(100)
    clock.now = 61_000
    await store.hit('fresh', 1_000)
    expect(store.size()).toBe(1)
  })
})

describe('redis rate store', () => {
  it('surfaces a failed command so the caller can fail open', async () => {
    const broken = {
      multi: () => ({
        set: () => undefined,
        incr: () => undefined,
        get: () => undefined,
        pttl: () => undefined,
        exec: async () => [[new Error('down'), null]] as Array<[Error | null, unknown]>
      }),
      del: async () => 0
    }
    await expect(createRedisStore(broken).hit('k', 1_000)).rejects.toThrow('down')
  })
})

describe('helpers', () => {
  it('namespaces keys by rule', () => {
    expect(ruleKey({ name: 'login-ip', limit: 1, windowSeconds: 1 }, '1.2.3.4')).toBe('ratelimit:login-ip:1.2.3.4')
  })

  it('rounds Retry-After up to whole seconds, never below one', () => {
    expect(retryAfterSeconds({ count: 9, resetAt: 10_500 }, 0)).toBe(11)
    expect(retryAfterSeconds({ count: 9, resetAt: 0 }, 5_000)).toBe(1)
  })

  it('takes the proxy-appended rightmost X-Forwarded-For entry, ignoring client-supplied ones', () => {
    expect(forwardedClientIp('6.6.6.6, 203.0.113.9')).toBe('203.0.113.9')
    expect(forwardedClientIp('203.0.113.9')).toBe('203.0.113.9')
    expect(forwardedClientIp(undefined)).toBeUndefined()
    expect(forwardedClientIp(' ')).toBeUndefined()
  })
})
