import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../db/schema'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000, // close idle connections after 30s
  connectionTimeoutMillis: 2000 // fail if can't connect in 2s
})

/**
 * Drizzle ORM database instance with schema bindings and connection pooling.
 */
export const db = drizzle({ client: pool, schema })
