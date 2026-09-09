import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

// srvx reaches us transitively (@nuxt/image -> ipx), so resolve defensively rather than assume it.
function resolveSrvxBunAdapter() {
  try {
    return [createRequire(import.meta.url).resolve('srvx/bun')]
  } catch {
    return []
  }
}

// @opentelemetry/resources ships no `exports` map, so Nitro's resolver loops on the bare specifier (ENOTDIR on a self-repeating build/src path) and the dev server dies before serving; alias to the ESM entry.
function resolveOtelResources() {
  try {
    const pkg = createRequire(import.meta.url).resolve('@opentelemetry/resources/package.json')
    return { '@opentelemetry/resources': join(dirname(pkg), 'build/esm/index.js') }
  } catch {
    return {}
  }
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@sentry/nuxt/module',
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/hints',
    '@nuxt/image',
    '@nuxt/test-utils',
    'nuxt-auth-utils'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    oauth: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET
      }
    },
    public: {
      appName: process.env.APP_NAME || 'My Fitness Journal',
      sentry: {
        dsn: process.env.SENTRY_DSN
      }
    }
  },

  routeRules: {},

  sourcemap: { client: 'hidden' },
  compatibilityDate: '2025-01-15',

  nitro: {
    alias: resolveOtelResources(),
    externals: {
      // Nitro traces srvx (pulled in by @nuxt/image's ipx) under the `node` export condition and
      // copies only its node adapter, but the Dockerfile runs `bun --bun`, which resolves srvx's
      // `bun` condition to a file that was never bundled. Tracing the bun adapter in as well keeps
      // both runtimes working. Must be an absolute path: traceInclude entries go through rollup's
      // resolver, which returns externals unresolved and leaves nft with a bare specifier.
      traceInclude: resolveSrvxBunAdapter()
    }
  },
  vite: {
    optimizeDeps: {
      include: [
        '@internationalized/date',
        'date-fns',
        'zod',
        '@vue/devtools-core',
        '@vue/devtools-kit'
      ]
    }
  },
  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  sentry: {
    // Bun supports neither --import nor --require, so the SDK has to be pulled in from the top of
    // the server entry instead of preloaded.
    autoInjectServerSentry: 'top-level-import',
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT || 'my-fitness-journal',
    authToken: process.env.SENTRY_AUTH_TOKEN,
    // Ungated, every production build uploads maps and cuts a release — including the one
    // @nuxt/test-utils makes per e2e run.
    sourcemaps: { disable: process.env.SENTRY_UPLOAD_SOURCEMAPS !== 'true' },
    telemetry: false
  }
})
