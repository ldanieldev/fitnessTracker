import { inngestProductionProblems } from '../utils/inngest/productionGuard'

// With dev mode or a guessable key, anyone who reaches /api/inngest can run any function as any user.
export default defineNitroPlugin(() => {
  // The e2e build runs against the local stub with the dev .env; NUXT_TEST_FIXTURES only exists there.
  if (import.meta.dev || import.meta.prerender || process.env.NUXT_TEST_FIXTURES === '1') return
  const problems = inngestProductionProblems(process.env)
  if (problems.length) {
    throw new Error(`Refusing to start in production: ${problems.join('; ')}. See README "Deploying / self-hosting".`)
  }
})
