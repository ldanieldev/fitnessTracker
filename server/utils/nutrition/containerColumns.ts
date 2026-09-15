import { mealContainers } from '~~/server/db/schema'

export const containerColumns = {
  id: mealContainers.id,
  name: mealContainers.name,
  sortOrder: mealContainers.sortOrder,
  isArchived: mealContainers.isArchived
}
