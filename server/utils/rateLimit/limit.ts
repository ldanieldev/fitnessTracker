import type { H3Event } from 'h3'
import { lastForwarded } from '../proxy'
import {
  createMemoryStore,
  createRedisStore,
  retryAfterSeconds,
  ruleKey,
  type RateCount,
  type RateRule,
  type RateStore,
  type RedisLike
} from './store'

const FIFTEEN_MINUTES = 15 * 60

export const RATE_RULES = {
  loginEmail: { name: 'login-email', limit: 10, windowSeconds: FIFTEEN_MINUTES },
  loginIp: { name: 'login-ip', limit: 30, windowSeconds: FIFTEEN_MINUTES },
  register: { name: 'register-ip', limit: 5, windowSeconds: 60 * 60 },
  passwordChange: { name: 'password-user', limit: 10, windowSeconds: FIFTEEN_MINUTES },
  badToken: { name: 'token-ip', limit: 30, windowSeconds: FIFTEEN_MINUTES }
} satisfies Record<string, RateRule>

export type RateCheck = [RateRule, string]

const memory = createMemoryStore()

// The e2e suite registers hundreds of users from one IP; the limits themselves are unit-tested.
const disabled = () => process.env.NUXT_TEST_FIXTURES === '1'

function currentStore(): RateStore {
  const driver = useStorage().getMount('cache').driver as {
    name?: string
    getInstance?: () => RedisLike & { status?: string }
  }
  const redis = driver.name === 'redis' ? driver.getInstance?.() : undefined
  return redis?.status === 'ready' ? createRedisStore(redis) : memory
}

// A store outage must not lock everyone out of signing in, so it fails open.
async function orNull<T>(op: () => Promise<T>): Promise<T | null> {
  try {
    return await op()
  } catch (error) {
    console.warn('[rate-limit] store unavailable; allowing the request', error)
    return null
  }
}

function tooMany(event: H3Event, count: RateCount): never {
  setResponseHeader(event, 'Retry-After', retryAfterSeconds(count, Date.now()))
  throw createError({ statusCode: 429, statusMessage: 'Too many attempts. Try again later.' })
}

export function clientIp(event: H3Event): string {
  return lastForwarded(event, 'x-forwarded-for') ?? getRequestIP(event) ?? 'unknown'
}

// Counts the attempt before the caller verifies anything, so parallel requests can't all slip under the limit.
export async function consumeLimits(event: H3Event, checks: RateCheck[]) {
  if (disabled()) return
  const store = currentStore()
  const counts = await Promise.all(
    checks.map(([rule, id]) => orNull(() => store.hit(ruleKey(rule, id), rule.windowSeconds * 1000)))
  )
  counts.forEach((count, i) => {
    if (count && count.count > checks[i]![0].limit) tooMany(event, count)
  })
}

export async function consumeLimit(event: H3Event, rule: RateRule, id: string) {
  await consumeLimits(event, [[rule, id]])
}

export async function refundLimits(checks: RateCheck[]) {
  if (disabled()) return
  const store = currentStore()
  await Promise.all(checks.map(([rule, id]) => orNull(() => store.refund(ruleKey(rule, id)))))
}

export async function clearLimit(rule: RateRule, id: string) {
  if (disabled()) return
  await orNull(() => currentStore().clear(ruleKey(rule, id)))
}
