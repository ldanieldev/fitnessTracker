import type { H3Event } from 'h3'
import { lastForwarded } from '../proxy'
import { logger } from '../logger'
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

const STORE_ERROR_LOG_INTERVAL_MS = 60_000
const lastStoreErrorLog = new Map<string, number>()

// A store outage must not lock everyone out of signing in, so it fails open.
async function orNull<T>(rule: RateRule, op: () => Promise<T>): Promise<T | null> {
  try {
    return await op()
  } catch (error) {
    const now = Date.now()
    if (now - (lastStoreErrorLog.get(rule.name) ?? -Infinity) >= STORE_ERROR_LOG_INTERVAL_MS) {
      lastStoreErrorLog.set(rule.name, now)
      logger.warn({ err: error, rule: rule.name }, 'rate-limit store unavailable; allowing the request')
    }
    return null
  }
}

function tooMany(event: H3Event, rule: RateRule, count: RateCount): never {
  const retryAfter = retryAfterSeconds(count, Date.now())
  logger.warn({ event: 'rate_limited', rule: rule.name, count: count.count, retryAfter }, 'rate limit exceeded')
  setResponseHeader(event, 'Retry-After', retryAfter)
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
    checks.map(([rule, id]) => orNull(rule, () => store.hit(ruleKey(rule, id), rule.windowSeconds * 1000)))
  )
  counts.forEach((count, i) => {
    if (count && count.count > checks[i]![0].limit) tooMany(event, checks[i]![0], count)
  })
}

export async function consumeLimit(event: H3Event, rule: RateRule, id: string) {
  await consumeLimits(event, [[rule, id]])
}

export async function refundLimits(checks: RateCheck[]) {
  if (disabled()) return
  const store = currentStore()
  await Promise.all(checks.map(([rule, id]) => orNull(rule, () => store.refund(ruleKey(rule, id)))))
}

export async function clearLimit(rule: RateRule, id: string) {
  if (disabled()) return
  await orNull(rule, () => currentStore().clear(ruleKey(rule, id)))
}
