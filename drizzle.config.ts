import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'
import { APP_SCHEMA_NAME } from './server/db/shared'

export default defineConfig({
  out: './drizzle',
  schema: './server/db/schema/index.ts',
  dialect: 'postgresql',
  // Without this drizzle-kit diffs only 'public', so generate/push silently no-op against the app's schema
  schemaFilter: [APP_SCHEMA_NAME],
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
})
