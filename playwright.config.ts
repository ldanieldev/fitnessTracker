import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'

// test-only fixture routes are gated on this; the Nitro server test-utils boots inherits it
process.env.NUXT_TEST_FIXTURES ??= '1'
// OFF-dependent specs must be hermetic: point at the test-only stub routes, never the real API, even if .env sets a real one
process.env.NUXT_OFF_USER_AGENT ??= 'my-fitness-journal-e2e/1.0'
process.env.NUXT_OFF_PRODUCT_URL = '/api/nutrition/_test/off/product'
process.env.NUXT_OFF_SEARCH_URL = '/api/nutrition/_test/off/search'

export default defineConfig<ConfigOptions>({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Each worker gets its own Nuxt build + Nitro server (worker-scoped fixture), so parallel workers multiply builds.
  workers: 1,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    nuxt: {
      rootDir: fileURLToPath(new URL('.', import.meta.url)),
      // A cold build overruns test-utils' 120s non-Windows default.
      setupTimeout: 240000,
      // Optional: point at an already-running `bun dev` to skip the per-run build entirely.
      host: process.env.NUXT_TEST_HOST
    }
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /mobile\//,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'oneplus-13-chromium',
      testMatch: /mobile\/.*\.spec\.ts/,
      use: { ...devices['Pixel 10'], viewport: { width: 360, height: 689 }, deviceScaleFactor: 4 }
    },
    {
      name: 'oneplus-13-firefox',
      testMatch: /mobile\/.*\.spec\.ts/,
      // Playwright does not support isMobile in Firefox; this checks Gecko layout at the phone's CSS size.
      use: { browserName: 'firefox', viewport: { width: 360, height: 689 }, deviceScaleFactor: 4, hasTouch: true }
    }
  ]
})
