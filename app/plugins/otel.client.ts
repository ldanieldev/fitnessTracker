import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { ZoneContextManager } from '@opentelemetry/context-zone'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load'

// Client-only plugin (.client.ts). Sends browser spans to the local Alloy
// OTLP/HTTP receiver, which forwards to Tempo.
export default defineNuxtPlugin(() => {
  // skip all browser tracing setup unless ENABLE_OPENTELEMETRY=true.
  if (!useRuntimeConfig().public.enableOtel) return

  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'my-fitness-journal-client' }),
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' }))]
  })

  provider.register({ contextManager: new ZoneContextManager() })

  registerInstrumentations({
    instrumentations: [new DocumentLoadInstrumentation(), new FetchInstrumentation()]
  })
})
