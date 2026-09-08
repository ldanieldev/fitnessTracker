import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  let db_ok = false

  try {
    await withQuerySpan('health-db-ping', () => db.execute(sql`SELECT 1`))
    db_ok = true
    logger.debug({ route: '/api/health' }, 'health check ok')
  } catch (error) {
    console.error('Database connection failed:', error)
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
