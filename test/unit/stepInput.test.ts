import { describe, expect, it } from 'vitest'
import {
  stepDayPutSchema,
  stepTargetPutSchema,
  stepTargetQuerySchema,
  stepWeeksQuerySchema
} from '../../server/utils/body/input'

describe('step input schemas', () => {
  it('accepts whole step counts from 0 to 200,000', () => {
    expect(stepDayPutSchema.safeParse({ steps: 0 }).success).toBe(true)
    expect(stepDayPutSchema.safeParse({ steps: 200000 }).success).toBe(true)
    expect(stepDayPutSchema.safeParse({ steps: 200001 }).success).toBe(false)
    expect(stepDayPutSchema.safeParse({ steps: -1 }).success).toBe(false)
    expect(stepDayPutSchema.safeParse({ steps: 1.5 }).success).toBe(false)
    expect(stepDayPutSchema.safeParse({ steps: '8000' }).success).toBe(false)
  })

  it('needs a positive whole target and a real date', () => {
    expect(stepTargetPutSchema.safeParse({ dailyTarget: 8000, effectiveFrom: '2026-10-04' }).success).toBe(true)
    expect(stepTargetPutSchema.safeParse({ dailyTarget: 0, effectiveFrom: '2026-10-04' }).success).toBe(false)
    expect(stepTargetPutSchema.safeParse({ dailyTarget: 8000.5, effectiveFrom: '2026-10-04' }).success).toBe(false)
    expect(stepTargetPutSchema.safeParse({ dailyTarget: 8000, effectiveFrom: '2026-02-30' }).success).toBe(false)
    expect(stepTargetPutSchema.safeParse({ dailyTarget: 8000 }).success).toBe(false)
  })

  it('coerces count from the query string, defaults to 1 and caps at 520', () => {
    expect(stepWeeksQuerySchema.parse({})).toEqual({ count: 1 })
    expect(stepWeeksQuerySchema.parse({ count: '26' })).toEqual({ count: 26 })
    expect(stepWeeksQuerySchema.safeParse({ count: '0' }).success).toBe(false)
    expect(stepWeeksQuerySchema.safeParse({ count: '521' }).success).toBe(false)
  })

  it('takes the client day as an optional real `to` date', () => {
    expect(stepWeeksQuerySchema.parse({ count: '2', to: '2026-10-10' })).toEqual({ count: 2, to: '2026-10-10' })
    expect(stepWeeksQuerySchema.safeParse({ to: '2026-02-30' }).success).toBe(false)
    expect(stepTargetQuerySchema.parse({})).toEqual({})
    expect(stepTargetQuerySchema.parse({ to: '2026-10-10' })).toEqual({ to: '2026-10-10' })
    expect(stepTargetQuerySchema.safeParse({ to: '10/10/2026' }).success).toBe(false)
  })
})
