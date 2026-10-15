import { cleanTestUsers } from '../../scripts/clean-test-users'
import { restoreAdmin } from './adminBorrow'

export default async function globalTeardown() {
  await restoreAdmin()
  const count = await cleanTestUsers()
  console.log(`globalTeardown: deleted ${count} test users`)
}
