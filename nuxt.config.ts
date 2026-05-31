// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/hints',
    '@nuxt/image',
    '@nuxt/test-utils',
    'nuxt-auth-utils',
    'nitro-opentelemetry'
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
      appName: process.env.APP_NAME || 'Fitness Tracker',
      enableOtel: process.env.ENABLE_OPENTELEMETRY === 'true'
    }
  },

  routeRules: {},

  compatibilityDate: '2025-01-15',

  nitro: {
    otel: {
      // name MUST be the literal 'custom' — nitro-opentelemetry only honors
      // preset.filePath when name === 'custom'.
      // filePath is resolved relative to project root;
      preset: {
        name: 'custom',
        filePath: './otel/instrumentation'
      }
    }
  },
  vite: {
    optimizeDeps: {
      include: [
        '@internationalized/date',
        '@opentelemetry/context-zone',
        '@opentelemetry/exporter-trace-otlp-http',
        '@opentelemetry/instrumentation',
        '@opentelemetry/instrumentation-document-load',
        '@opentelemetry/instrumentation-fetch',
        '@opentelemetry/resources',
        '@opentelemetry/sdk-trace-base',
        '@opentelemetry/sdk-trace-web',
        '@opentelemetry/semantic-conventions',
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
  }
})
