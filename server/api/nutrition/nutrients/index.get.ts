import { nutrientCatalog } from '~~/server/utils/nutrition/nutrientIds'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireUserId(event)
  const catalog = await nutrientCatalog()
  return catalog.map((n) => ({
    id: n.id,
    key: n.key,
    name: n.name,
    unit: n.unit,
    isMacro: n.isMacro,
    defaultDirection: n.defaultDirection
  }))
})
