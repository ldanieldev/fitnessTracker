import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'

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
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
