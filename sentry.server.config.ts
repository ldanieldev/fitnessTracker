import * as Sentry from '@sentry/nuxt'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enableLogs: true,
  // Every field is set explicitly because the two ways of leaving one out differ: an absent
  // `dataCollection` key falls back to the deprecated `sendDefaultPii` bridge (restrictive), while
  // a present one — even `{}` — selects spec DEFAULTS, which collect user info, cookies and HTTP
  // bodies. v11 drops the bridge.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: false, response: false },
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false
  },
  tracesSampleRate: 1.0
})
