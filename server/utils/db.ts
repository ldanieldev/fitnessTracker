import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import * as schema from '../db/schema'
import { recordQueryDuration } from './metrics'

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

/**
 * Wraps a DB operation in a span and records its duration. Fallback for runtimes (Bun) where
 * @opentelemetry/instrumentation-pg auto-patching does not fire — verified
 * empirically: pg produced no spans under Bun, so queries are wrapped manually.
 */
export async function withQuerySpan<T>(opName: string, fn: () => Promise<T>): Promise<T> {
  const tracer = trace.getTracer('my-fitness-journal-db')
  return tracer.startActiveSpan('pg.query', async (span) => {
    span.setAttribute('db.system', 'postgresql')
    span.setAttribute('db.operation', opName)
    const start = performance.now()
    let outcome = 'ok'
    try {
      return await fn()
    } catch (err) {
      outcome = 'error'
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) })
      span.recordException(err as Error)
      throw err
    } finally {
      span.end()
      recordQueryDuration((performance.now() - start) / 1000, {
        'db.operation.name': opName,
        'db.response.status_code': outcome
      })
    }
  })
}
