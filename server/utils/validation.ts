import type { H3Event } from 'h3'
import { z } from 'zod'
import { isCalendarDate } from '~~/shared/utils/calendarDate'
import { shiftDate, todayDate } from '~~/shared/utils/nutritionSummary'

export const INT4_MAX = 2_147_483_647
export const SMALLINT_MAX = 32_767

/** A positive id that fits a Postgres `integer` column. */
export const zId = z.number().int().positive().max(INT4_MAX)

/** A route `[id]` param: digits only, positive, within `integer` range. */
export const idParamSchema = z
  .string()
  .regex(/^\d{1,10}$/)
  .transform(Number)
  .pipe(zId)

export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine(isCalendarDate, 'Date must be a real calendar date')

/** Within a day of the server's date: the most a client's local "today" can differ from it. */
export function isNearServerDate(date: string): boolean {
  const server = todayDate()
  return date >= shiftDate(server, -1) && date <= shiftDate(server, 1)
}

/** A client "today" that drives a write; e2e builds accept any date so specs can simulate weeks passing. */
export const nearTodaySchema = calendarDateSchema.refine(
  (date) => process.env.NUXT_TEST_FIXTURES === '1' || isNearServerDate(date),
  'today must be within a day of the server date'
)

/** Reads a numeric route param, answering 400 for anything that is not a valid id. */
export function routeId(event: H3Event, name = 'id'): number {
  const parsed = idParamSchema.safeParse(getRouterParam(event, name))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: `Invalid ${name}` })
  return parsed.data
}

/** A record whose key count is capped, since zod's `record` has no `.max()`. */
export function boundedRecord<V extends z.ZodType>(value: V, maxKeys: number, maxKeyLength = 64) {
  return z
    .record(z.string().max(maxKeyLength), value)
    .refine((r) => Object.keys(r).length <= maxKeys, `At most ${maxKeys} entries`)
}
