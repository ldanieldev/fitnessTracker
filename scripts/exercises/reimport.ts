import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'
import { CATALOGUE_FILE, catalogueBounds } from './catalogueBlock'

const migration = readFileSync(CATALOGUE_FILE, 'utf8')
const { start, end } = catalogueBounds(migration)
const statements = migration
  .slice(start, end)
  .split('--> statement-breakpoint')
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0)

// pg would otherwise fall back to PG* variables and localhost, and could re-import into the wrong database.
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')

const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  await client.query('begin')
  for (const statement of statements) await client.query(statement)
  await client.query('commit')
} catch (err) {
  await client.query('rollback').catch(() => {})
  throw err
} finally {
  await client.end()
}
console.log(`re-imported the catalogue from ${CATALOGUE_FILE} (${statements.length} statements)`)
