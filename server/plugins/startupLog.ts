import { fileSinkActive, logger } from '../utils/logger'

const set = (value: unknown) => typeof value === 'string' ? value.trim() !== '' : Boolean(value)

export default defineNitroPlugin(() => {
  if (import.meta.prerender) return
  const config = useRuntimeConfig()
  logger.info(
    {
      logLevel: logger.level,
      fileSink: fileSinkActive,
      registration: String(config.registration),
      trustProxy: String(config.trustProxy) === 'true',
      services: {
        redis: set(process.env.NUXT_REDIS_URL),
        meilisearch: set(config.meili.host),
        sentry: set(process.env.SENTRY_DSN),
        otel: process.env.ENABLE_OPENTELEMETRY === 'true',
        githubOAuth: set(config.oauth.github.clientId) && set(config.oauth.github.clientSecret),
        googleOAuth: set(config.oauth.google.clientId) && set(config.oauth.google.clientSecret),
        googleHealthTokenKey: set(config.googleHealth.tokenKey),
        usda: set(config.usda.apiKey),
        fatsecret: set(config.fatsecret.clientId) && set(config.fatsecret.clientSecret),
        offUserAgent: set(config.off.userAgent)
      }
    },
    'server starting'
  )
})
