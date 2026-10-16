import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'
import { APP_SCHEMA_NAME } from './server/db/shared'

// Migrations write now() into plain (UTC) timestamp columns, so the session must not follow a non-UTC server.
function utcUrl(raw: string | undefined) {
  if (!raw) return raw!
  const url = new URL(raw)
  url.searchParams.set('options', '-c TimeZone=UTC')
  return url.toString()
}

export default defineConfig({
  out: './drizzle',
  schema: './server/db/schema/index.ts',
  dialect: 'postgresql',
  // Without this drizzle-kit diffs only 'public', so generate/push silently no-op against the app's schema
  schemaFilter: [APP_SCHEMA_NAME],
  dbCredentials: {
    url: utcUrl(process.env.DATABASE_URL)
  }
})
