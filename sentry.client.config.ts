import * as Sentry from '@sentry/nuxt'

const replay = useRuntimeConfig().public.sentry.replay === true

Sentry.init({
  dsn: useRuntimeConfig().public.sentry.dsn,
  // Must be a string: `...options` spreads over the SDK fallback, so `undefined` makes events default to 'production'.
  environment: useRuntimeConfig().public.sentry.environment || (import.meta.dev ? 'development' : 'production'),
  enableLogs: true,
  // Explicit for the same reason as the server config — see sentry.server.config.ts.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: false, response: false },
    httpBodies: [],
    urlQueryParams: false
  },
  integrations: replay ? [Sentry.replayIntegration()] : [],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: replay ? 0.1 : 0,
  replaysOnErrorSampleRate: replay ? 1.0 : 0
})
