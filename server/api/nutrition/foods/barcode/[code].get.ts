import { and, eq, inArray, isNull } from 'drizzle-orm'
import { foods } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { findFirstBarcodeMatch, getExternalSources } from '~~/server/utils/nutrition/external/registry'
import { barcodeCandidates } from '~~/server/utils/nutrition/barcodeCandidates'
import { requireUserId } from '~~/server/utils/nutrition/session'

const BARCODE_RE = /^\d{8,14}$/

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const code = getRouterParam(event, 'code') ?? ''
  if (!BARCODE_RE.test(code)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid barcode' })
  }

  const codes = barcodeCandidates(code)

  const own = await db
    .select({ id: foods.id })
    .from(foods)
    .where(and(inArray(foods.barcode, codes), eq(foods.createdByUserId, userId), isNull(foods.deletedAt)))
    .limit(1)
    .then((r) => r[0])
  if (own) return { found: 'local', foodId: own.id }

  const catalogue = await db
    .select({ id: foods.id })
    .from(foods)
    .where(and(inArray(foods.barcode, codes), isNull(foods.createdByUserId), isNull(foods.deletedAt)))
    .limit(1)
    .then((r) => r[0])
  if (catalogue) return { found: 'local', foodId: catalogue.id }

  const { match, source, errors } = await findFirstBarcodeMatch(getExternalSources(), code)
  if (match) return { found: source, external: match }

  throw createError({ statusCode: 404, statusMessage: 'Barcode not found', data: { barcode: code, errors } })
})
