import { z } from 'zod'
import { setUserActive } from '~~/server/utils/admin/accounts'
import { requireAdmin } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

const bodySchema = z.object({ isActive: z.boolean() })

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = routeId(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Validation Error', data: z.flattenError(parsed.error) })
  }
  if (id === admin.id) {
    throw createError({ statusCode: 400, statusMessage: 'You cannot change your own account here' })
  }
  if (!(await setUserActive(db, id, parsed.data.isActive))) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  return { id, isActive: parsed.data.isActive }
})
