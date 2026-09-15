import redisDriver from 'unstorage/drivers/redis'
import { resolveRedisCache } from '../utils/cache/redisMount'

const PROBE_TIMEOUT_MS = 700
const PROBE_KEY = '__probe'

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('probe timed out')), ms))
}

// nuxt.config's nitro.storage bakes options into the build and drops function values (retryStrategy), so build it here instead.
async function setupRedisCache(url: string): Promise<void> {
  const host = new URL(url).host

  const driver = redisDriver({
    url,
    connectTimeout: 500,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy: () => null
  })

  let warned = false
  const warnOnce = (message: string) => {
    if (warned) return
    warned = true
    console.warn(message)
  }
  const unreachableMessage = `[cache] Redis unreachable at ${host}; using the in-memory cache`
  // Without a listener, ioredis logs its own "Unhandled error event" on top of our warning.
  driver.getInstance?.()?.on('error', () => warnOnce(unreachableMessage))

  // lazyConnect + enableOfflineQueue: false never auto-connects on a command (ioredis 6.0.0) — connect() explicitly.
  const probe = async () => {
    await driver.getInstance!().connect()
    await driver.getItem(PROBE_KEY)
  }
  const outcome = await resolveRedisCache(
    url,
    () => Promise.race([probe(), timeout(PROBE_TIMEOUT_MS)]),
    warnOnce
  )

  if (outcome === 'redis') {
    await useStorage().unmount('cache')
    useStorage().mount('cache', driver)
    console.info('[cache] Redis cache mounted')
    return
  }

  driver.dispose?.()
  driver.getInstance?.()?.disconnect()
}

// Nitro's plugin loop never awaits plugins (nitropack/runtime/internal/app.mjs runNitroPlugins) — stay synchronous and gate requests on an already-caught promise instead.
export default defineNitroPlugin((nitroApp) => {
  const url = process.env.NUXT_REDIS_URL
  if (!url) return

  const ready = setupRedisCache(url).catch((err) => {
    console.warn('[cache] Redis setup failed; using the in-memory cache', err)
  })
  nitroApp.hooks.hook('request', () => ready)
})
