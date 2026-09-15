import type { MaybeRefOrGetter } from 'vue'
import { evaluateTarget } from '~~/shared/utils/nutritionTargets'
import type { DiaryTargetRow } from '~/composables/useDiaryDay'

// Non-blocking: no internal await, so callers (e.g. the shared layout) don't stall SSR/hydration on nutrition data. Callers that need the data settled can await the returned `*Fetch` handles themselves.
export function useDaySummary(date: MaybeRefOrGetter<string>, opts: { immediate?: boolean } = {}) {
  const { day, updateEntry, deleteEntry, fetch: dayFetch } = useDiaryDay(date, opts)
  const { tracked, fetch: trackedFetch } = useTrackedNutrients()
  const profilesFetch = useNutritionFetch<Array<{ id: number, name: string, isDefault: boolean }>>(NUTRITION_KEYS.profiles, '/api/nutrition/goal-profiles')
  const profiles = profilesFetch.data

  const goalName = computed(() => {
    const id = day.value?.goalProfileId
    if (id == null) return profiles.value?.find((p) => p.isDefault)?.name ?? null
    return profiles.value?.find((p) => p.id === id)?.name ?? 'Deleted profile'
  })

  const targets = computed<DiaryTargetRow[]>(() => {
    const dayTargets = day.value?.targets ?? []
    const byKey = new Map(dayTargets.map((t) => [t.key, t]))
    return (tracked.value ?? []).map((nutrient) => {
      const target = byKey.get(nutrient.key)
      return target
        ? { key: target.key, name: target.name, unit: target.unit, amount: target.amount, direction: target.direction }
        : { key: nutrient.key, name: nutrient.name, unit: nutrient.unit, amount: null, direction: null }
    })
  })

  const totals = computed(() => day.value?.totals ?? {})

  const subtotalNutrients = computed(() => (tracked.value ?? []).map((n) => ({ key: n.key, name: n.name, unit: n.unit })))

  const energyLeft = computed(() => {
    const energy = targets.value.find((t) => t.key === 'energy')
    if (!energy || energy.amount === null || energy.direction === null) return null
    return evaluateTarget({ consumed: totals.value.energy ?? 0, target: energy.amount, direction: energy.direction }).remaining
  })

  return { day, profiles, updateEntry, deleteEntry, goalName, targets, totals, subtotalNutrients, energyLeft, dayFetch, trackedFetch, profilesFetch }
}
