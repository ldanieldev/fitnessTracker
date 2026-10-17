import redisDriver from 'unstorage/drivers/redis'
import memoryDriver from 'unstorage/drivers/memory'
import { outageTracker, redisHost, redisRetryDelay, withFallback } from '../utils/cache/redisFallback'

// nitro.storage in nuxt.config bakes options into the build and drops functions (retryStrategy); build it here.
async function setupRedisCache(url: string): Promise<void> {
  const redis = redisDriver({
    url,
    connectTimeout: 500,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    retryStrategy: redisRetryDelay
  })
  const client = redis.getInstance!()
  const tracker = outageTracker(redisHost(url), console)
  client.on('ready', tracker.ready)
  // Also stops ioredis printing its own "Unhandled error event" for every failed reconnect.
  client.on('error', tracker.lost)
  client.on('close', tracker.lost)

  await useStorage().unmount('cache')
  const isUp = () => client.status === 'ready'
  useStorage().mount('cache', withFallback(redis, memoryDriver(), isUp, tracker.commandFailed))
}

// Nitro never awaits plugins (runNitroPlugins), so stay synchronous and gate requests on an already-caught promise.
export default defineNitroPlugin((nitroApp) => {
  const url = process.env.NUXT_REDIS_URL
  if (!url) return

  const ready = setupRedisCache(url).catch((err) => {
    console.warn('[cache] Redis setup failed; using the in-memory cache', err)
  })
  nitroApp.hooks.hook('request', () => ready)
})
