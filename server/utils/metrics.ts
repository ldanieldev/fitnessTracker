import { metrics, type Histogram } from '@opentelemetry/api'

// Built on first use, not at module scope: unlike traces there is no proxy meter provider, so a
// meter taken before server/plugins/otelMetrics.ts registers the global one stays a permanent
// no-op. When ENABLE_OPENTELEMETRY is off no provider is ever registered and these stay no-ops.
let requestDuration: Histogram | undefined
let queryDuration: Histogram | undefined

export function recordRequestDuration(seconds: number, attributes: Record<string, string | number>) {
  requestDuration ??= metrics.getMeter('my-fitness-journal').createHistogram(
    'http.server.request.duration',
    { unit: 's', description: 'Duration of inbound HTTP requests' }
  )
  requestDuration.record(seconds, attributes)
}

export function recordQueryDuration(seconds: number, attributes: Record<string, string | number>) {
  queryDuration ??= metrics.getMeter('my-fitness-journal-db').createHistogram(
    'db.client.operation.duration',
    { unit: 's', description: 'Duration of database operations' }
  )
  queryDuration.record(seconds, attributes)
}
