import { listAdminUsers } from '~~/server/utils/admin/accounts'
import { requireAdmin } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return listAdminUsers(db)
})
