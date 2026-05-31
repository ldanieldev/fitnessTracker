import { describe, it, expect, vi } from 'vitest'
import { trace } from '@opentelemetry/api'
import { withQuerySpan } from '../../server/utils/db'

describe('withQuerySpan', () => {
  it('wraps the callback in a span named "pg.query" and returns its result', async () => {
    const startSpan = vi.fn((_name, fn) => fn({
      end: vi.fn(),
      setStatus: vi.fn(),
      recordException: vi.fn(),
      setAttribute: vi.fn()
    }))
    vi.spyOn(trace, 'getTracer').mockReturnValue({ startActiveSpan: startSpan } as unknown as ReturnType<typeof trace.getTracer>)

    const result = await withQuerySpan('test-query', async () => 42)

    expect(result).toBe(42)
    expect(startSpan).toHaveBeenCalledWith('pg.query', expect.any(Function))
  })
})
