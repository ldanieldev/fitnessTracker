import { NodeSDK } from '@opentelemetry/sdk-node'
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg'

if (process.env.ENABLE_OPENTELEMETRY === 'true') {
  const sdk = new NodeSDK({
    instrumentations: [new PgInstrumentation()]
  })
  sdk.start()
}
