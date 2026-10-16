import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { escapeIdentifier, escapeLiteral, Pool } from 'pg'
import { APP_SCHEMA_NAME } from '../server/db/shared'

// The release image has no drizzle-kit; this applies the same drizzle/ folder and journal table drizzle-kit uses.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Migrations write now() into plain (UTC) timestamp columns, as in drizzle.config.ts.
  options: '-c TimeZone=UTC'
})

// Re-granted on every run so tables from new migrations reach the app role without default-privilege setup.
async function grantAppRole(user: string, password: string) {
  const role = escapeIdentifier(user)
  const schema = escapeIdentifier(APP_SCHEMA_NAME)
  const exists = await pool.query('select 1 from pg_roles where rolname = $1', [user])
  const verb = exists.rowCount ? 'ALTER' : 'CREATE'
  await pool.query(`${verb} ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${escapeLiteral(password)}`)
  await pool.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`)
  await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${role}`)
  await pool.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA ${schema} TO ${role}`)
}

try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: process.env.MIGRATIONS_DIR || 'drizzle' })
  console.log('migrations applied')
  const { APP_DB_USER: user, APP_DB_PASSWORD: password } = process.env
  if (user && password) {
    await grantAppRole(user, password)
    console.log(`app role ${user} granted read/write on schema ${APP_SCHEMA_NAME}`)
  }
} finally {
  await pool.end()
}
