import * as Sentry from '@sentry/nuxt'

Sentry.init({
  dsn: useRuntimeConfig().public.sentry.dsn,
  // Must resolve to a string: `...options` is spread after the SDK's own fallback, so an explicit `undefined` blanks it and prepareEvent defaults to 'production'.
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
  // Replay is client-only.
  integrations: [Sentry.replayIntegration()],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
})
