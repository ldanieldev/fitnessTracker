export function useTodaySummary() {
  const today = useToday()
  const summary = useDaySummary(computed(() => today.value ?? ''), { immediate: false })
  // Nuxt only re-executes a key change when the fetch was immediate or had data, so the first fetch after today resolves has to be explicit.
  watch(
    today,
    (value) => {
      if (value !== null) summary.dayFetch.refresh()
    },
    { immediate: true }
  )
  return summary
}
