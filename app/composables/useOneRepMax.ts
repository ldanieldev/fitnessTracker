import type { Ref } from 'vue'
import type { OneRepMaxResult } from '~~/shared/types/workout'
import { todayDate } from '~~/shared/utils/nutritionSummary'

export function useOneRepMax(exerciseId: Ref<number | null>) {
  const result = ref<OneRepMaxResult | null>(null)
  const pending = ref(false)
  const failed = ref(false)
  let latest = 0
  let shownFor: number | null = null

  async function load() {
    const id = exerciseId.value
    const request = ++latest
    failed.value = false
    if (id !== shownFor) result.value = null
    shownFor = id
    if (id === null) {
      pending.value = false
      return
    }
    pending.value = true
    try {
      // The local date, not the server's UTC one, bounds the 90-day window.
      const value = await apiFetch<OneRepMaxResult>(`/api/workouts/exercises/${id}/one-rep-max`, { query: { on: todayDate() } })
      if (request === latest) result.value = value
    } catch {
      if (request === latest) {
        result.value = null
        failed.value = true
      }
    } finally {
      if (request === latest) pending.value = false
    }
  }

  return { result, pending, failed, load }
}
