import { defaultServing, selectGramBasis } from '~~/shared/utils/nutritionResolve'
import { energyDensity } from '~~/shared/utils/nutritionDerive'
import { db } from '~~/server/utils/db'
import { loadFood } from '~~/server/utils/nutrition/loadFood'
import { requireUserId } from '~~/server/utils/nutrition/session'
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

  return {
    ...food,
    defaultServingId: defaultServing(food)?.id ?? null,
    energyDensity: basis
      ? energyDensity(basis.nutrients[energyNutrientId] ?? null, basis.basisGrams)
      : null
  }
})
