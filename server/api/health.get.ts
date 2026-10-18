import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  let db_ok = false

  try {
    await withQuerySpan('health-db-ping', () => db.execute(sql`SELECT 1`))
    db_ok = true
  } catch (error) {
    logger.error({ err: error }, 'health check database ping failed')
  }

  if (!db_ok) {
    setResponseStatus(event, 503)
  }

  return {
    status: db_ok ? 'healthy' : 'unhealthy',
    checks: {
      server: 'up',
      db: db_ok ? 'up' : 'down'
    }
  }
})
