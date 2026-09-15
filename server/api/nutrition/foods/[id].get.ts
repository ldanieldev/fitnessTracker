import { eq } from 'drizzle-orm'
import { defaultServing, selectGramBasis } from '~~/shared/utils/nutritionResolve'
import { energyDensity } from '~~/shared/utils/nutritionDerive'
import { foodSources } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadFood } from '~~/server/utils/nutrition/loadFood'
import { requireUserId } from '~~/server/utils/session'
import { getNutrientId } from '~~/server/utils/nutrition/nutrientIds'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid food ID' })
  }

  const food = await loadFood(db, userId, id)
  if (!food) {
    throw createError({ statusCode: 404, statusMessage: 'Food not found' })
  }

  const basis = selectGramBasis(food)
  const energyNutrientId = await getNutrientId('energy')

  // A manually created food never carries a sourceId; report it as sourced from no external catalogue.
  const source = food.sourceId === null
    ? null
    : await db
        .select({
          key: foodSources.key,
          name: foodSources.name,
          attributionRequired: foodSources.attributionRequired,
          licenseNotice: foodSources.licenseNotice
        })
        .from(foodSources)
        .where(eq(foodSources.id, food.sourceId))
        .limit(1)
        .then((r) => r[0] ?? null)

  return {
    ...food,
    source,
    defaultServingId: defaultServing(food)?.id ?? null,
    energyDensity: basis
      ? energyDensity(basis.nutrients[energyNutrientId] ?? null, basis.basisGrams)
      : null
  }
})
