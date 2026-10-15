import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../../server/db/schema'
import type { RootDbClient } from '../../server/utils/db'

export async function withAdminDb<T>(fn: (client: RootDbClient) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    return await fn(drizzle({ client: pool, schema }))
  } finally {
    await pool.end()
  }
}
