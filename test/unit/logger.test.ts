import { describe, it, expect, vi, afterEach } from 'vitest'
import { trace } from '@opentelemetry/api'
import { traceContextMixin } from '../../server/utils/logger'

afterEach(() => vi.restoreAllMocks())

describe('traceContextMixin', () => {
  it('returns an empty object when there is no active span', () => {
    vi.spyOn(trace, 'getActiveSpan').mockReturnValue(undefined)
    expect(traceContextMixin()).toEqual({})
  })

  it('returns trace_id and span_id from the active span', () => {
    vi.spyOn(trace, 'getActiveSpan').mockReturnValue({
      spanContext: () => ({ traceId: 'a'.repeat(32), spanId: 'b'.repeat(16) })
    } as unknown as ReturnType<typeof trace.getActiveSpan>)
    expect(traceContextMixin()).toEqual({
      trace_id: 'a'.repeat(32),
      span_id: 'b'.repeat(16)
    })
  })

  it('returns an empty object for an invalid (all-zero) span context, e.g. when the SDK is disabled', () => {
    vi.spyOn(trace, 'getActiveSpan').mockReturnValue({
      spanContext: () => ({ traceId: '0'.repeat(32), spanId: '0'.repeat(16) })
    } as unknown as ReturnType<typeof trace.getActiveSpan>)
    expect(traceContextMixin()).toEqual({})
  })
})
