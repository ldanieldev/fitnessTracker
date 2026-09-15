import { describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { NUTRITION_KEYS, invalidateNutrition, useNutritionFetch } from '../../app/composables/useNutritionData'

describe('useNutritionData', () => {
  it('refetches a keyed list after invalidateNutrition', async () => {
    let calls = 0
    registerEndpoint('/api/nutrition/meal-containers', () => {
      calls += 1
      return [{ id: calls, name: `Meal ${calls}` }]
    })
    const { data } = await useNutritionFetch<Array<{ id: number }>>(NUTRITION_KEYS.containers, '/api/nutrition/meal-containers')
    expect(data.value?.[0]?.id).toBe(1)
    await invalidateNutrition(NUTRITION_KEYS.containers)
    expect(data.value?.[0]?.id).toBe(2)
  })

  it('refreshes every logged-week key by prefix', async () => {
    let calls = 0
    registerEndpoint('/api/nutrition/diary/logged', () => {
      calls += 1
      return { dates: [] }
    })
    await useNutritionFetch(NUTRITION_KEYS.logged('2026-09-07'), '/api/nutrition/diary/logged?from=2026-09-07&to=2026-09-13')
    await invalidateNutrition('nutrition:logged:')
    expect(calls).toBe(2)
  })
})
