import { todayDate } from '~~/shared/utils/nutritionSummary'

// Starts at the SSR-safe local date; moves only if useToday() resolves to another day, so no post-hydration refetch.
export function useTodayOrNow() {
  const today = useToday()
  const to = ref(todayDate())
  watch(
    today,
    (value) => {
      if (value && value !== to.value) to.value = value
    },
    { immediate: true }
  )
  return to
}
