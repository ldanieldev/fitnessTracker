import 'dotenv/config'
import { like, or } from 'drizzle-orm'
import { users } from '../server/db/schema'
import { db } from '../server/utils/db'
import { deleteAccount } from '../server/utils/deleteAccount'

// Domains reserved for testing (RFC 2606); e2e helpers and visual-check seeds register only these.
const TEST_EMAIL = or(...['example.com', 'example.test', 'example.invalid'].map((d) => like(users.email, `%@${d}`)))

export async function cleanTestUsers(opts: { dryRun?: boolean } = {}): Promise<number> {
  const rows = await db.select({ id: users.id }).from(users).where(TEST_EMAIL)
  if (!opts.dryRun) for (const { id } of rows) await deleteAccount(id)
  return rows.length
}

if (import.meta.main) {
  const dryRun = process.argv.includes('--dry-run')
  const count = await cleanTestUsers({ dryRun })
  console.log(`${dryRun ? 'would delete' : 'deleted'} ${count} test users`)
  process.exit(0)
}
