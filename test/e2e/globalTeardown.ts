import { cleanTestUsers } from '../../scripts/clean-test-users'

export default async function globalTeardown() {
  const count = await cleanTestUsers()
  console.log(`globalTeardown: deleted ${count} test users`)
}
