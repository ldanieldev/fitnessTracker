import type { MaybeRefOrGetter } from 'vue'
import { errorMessage } from '~/utils/apiError'
import type { EntryType, TargetDirection } from '~~/shared/types/nutrition'

export interface DiaryTarget {
  key: string
  name: string
  unit: string
  amount: number
  direction: TargetDirection
}

export interface DiaryTargetRow {
  key: string
  name: string
  unit: string
  amount: number | null
  direction: TargetDirection | null
}

export interface DiaryEntry {
  id: number
  containerId: number
  entryType: EntryType
  foodId: number | null
  foodServingId: number | null
  recipeId: number | null
  quantity: number
  unitLabel: string
  gramsResolved: number | null
  description: string | null
  brandSnapshot: string | null
  loggedAt: string
  notes: string | null
  ingredientSnapshot: unknown
  nutrients: Record<string, number>
}

export interface DiaryContainer {
  id: number
  name: string
  sortOrder: number
  isArchived: boolean
  entries: DiaryEntry[]
  subtotals: Record<string, number>
  mealTime: string | null
}

export interface DiaryDay {
  date: string
  persisted: boolean
  notes: string | null
  goalProfileId: number | null
  targets: DiaryTarget[]
  containers: DiaryContainer[]
  entries: DiaryEntry[]
  totals: Record<string, number>
}

export interface DiaryEntryInput {
  entryType: EntryType
  containerId: number
  quantity: number
  unitLabel: string
  foodId?: number
  recipeId?: number
  savedMealId?: number
  description?: string
  loggedAt?: string
  notes?: string
  nutrients?: Record<string, number>
}

export interface DiaryEntryPatch {
  quantity?: number
  unitLabel?: string
  containerId?: number
  loggedAt?: string
  notes?: string | null
}

export function useDiaryDay(date: MaybeRefOrGetter<string>, opts: { immediate?: boolean } = {}) {
  const toast = useToast()
  const fetch = useNutritionFetch<DiaryDay>(
    () => NUTRITION_KEYS.day(toValue(date)),
    () => `/api/nutrition/diary/${toValue(date)}`,
    { watch: [() => toValue(date)], immediate: opts.immediate ?? true }
  )
  const { data: day, refresh, status, error } = fetch

  function fail(title: string, err: unknown, fallback: string) {
    toast.add({ title, description: errorMessage(err, fallback), color: 'error' })
  }

  async function logEntries(inputs: DiaryEntryInput[]): Promise<{ ids: number[] } | null> {
    try {
      const result = await apiFetch<{ ids: number[] }>(`/api/nutrition/diary/${toValue(date)}/entries`, {
        method: 'POST',
        body: inputs
      })
      await invalidateNutrition(NUTRITION_KEYS.day(toValue(date)), 'nutrition:logged:')
      return result
    } catch (err) {
      fail('Log failed', err, 'Could not log these entries')
      return null
    }
  }

  async function updateEntry(id: number, patch: DiaryEntryPatch): Promise<boolean> {
    try {
      await apiFetch(`/api/nutrition/diary/entries/${id}`, { method: 'PUT', body: patch })
      await invalidateNutrition(NUTRITION_KEYS.day(toValue(date)), 'nutrition:logged:')
      return true
    } catch (err) {
      fail('Update failed', err, 'Could not update this entry')
      return false
    }
  }

  async function deleteEntry(id: number): Promise<boolean> {
    try {
      await apiFetch(`/api/nutrition/diary/entries/${id}`, { method: 'DELETE' })
      await invalidateNutrition(NUTRITION_KEYS.day(toValue(date)), 'nutrition:logged:')
      return true
    } catch (err) {
      fail('Delete failed', err, 'Could not delete this entry')
      return false
    }
  }

  return { day, refresh, status, error, logEntries, updateEntry, deleteEntry, fetch }
}
