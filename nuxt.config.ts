import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

// Both reach us transitively (@nuxt/image -> ipx -> srvx, h3 -> uncrypto), so resolve defensively rather than assume.
function resolveBunConditionEntries() {
  const require = createRequire(import.meta.url)
  const tryResolve = (resolve: () => string) => {
    try {
      return [resolve()]
    } catch {
      return []
    }
  }
  return [
    ...tryResolve(() => require.resolve('srvx/bun')),
    ...tryResolve(() => join(dirname(require.resolve('uncrypto')), 'crypto.web.mjs'))
  ]
}

const uploadSourcemaps = process.env.SENTRY_UPLOAD_SOURCEMAPS === 'true'

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
  'Strict-Transport-Security': 'max-age=15552000'
}

// @opentelemetry/resources has no `exports` map, so Nitro's resolver loops (ENOTDIR) and dev dies; alias the ESM entry.
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

  $development: {
    runtimeConfig: {
      session: {
        cookie: {
          // Browsers only exempt localhost from the Secure attribute, so a LAN-IP dev host drops the session cookie.
          secure: false
        }
      }
    },
    vite: {
      server: {
        allowedHosts: true
      }
    }
  },

  $production: {
    routeRules: {
      '/**': { headers: SECURITY_HEADERS }
    },
    nitro: {
      ignore: process.env.NUXT_TEST_FIXTURES === '1' ? [] : ['**/_test/**']
    }
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  },

  runtimeConfig: {
    session: {
      // Seconds since the session cookie was first issued; h3 enforces it on the cookie, seal TTL and unseal.
      maxAge: 60 * 60 * 24 * 30
    },
    registration: 'open',
    trustProxy: false,
    // Values come from NUXT_* env at boot; reading process.env here would bake secrets into .output.
    meili: {
      host: '',
      apiKey: ''
    },
    off: {
      userAgent: '',
      productUrl: 'https://world.openfoodfacts.org/api/v2/product',
      searchUrl: 'https://search.openfoodfacts.org/search'
    },
    usda: {
      apiKey: ''
    },
    fatsecret: {
      clientId: '',
      clientSecret: '',
      scope: 'basic'
    },
    googleHealth: {
      tokenKey: '',
      apiBase: 'https://health.googleapis.com',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      revokeUrl: 'https://oauth2.googleapis.com/revoke',
      syncCooldownSeconds: 60
    },
    oauth: {
      google: {
        clientId: '',
        clientSecret: ''
      },
      github: {
        clientId: '',
        clientSecret: ''
      }
    },
    public: {
      appName: process.env.APP_NAME || 'My Fitness Journal',
      sentry: {
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT ?? ''
      }
    }
  },

  routeRules: {},

  sourcemap: { client: uploadSourcemaps ? 'hidden' : false },
  compatibilityDate: '2025-01-15',

  nitro: {
    alias: resolveOtelResources(),
    externals: {
      // Nitro copies only `node`-condition files but `bun --bun` loads `bun` ones; absolute, or nft sees bare names.
      traceInclude: resolveBunConditionEntries()
    }
  },
  vite: {
    optimizeDeps: {
      include: [
        '@internationalized/date',
        'date-fns',
        'zod',
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'tesseract.js',
        'zxing-wasm/reader'
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
    sourcemaps: {
      disable: !uploadSourcemaps,
      // Setting sourcemap.client ourselves turns off the module's post-upload deletion, so name the public maps.
      filesToDeleteAfterUpload: ['.*/**/public/**/*.map']
    },
    telemetry: false
  }
})
