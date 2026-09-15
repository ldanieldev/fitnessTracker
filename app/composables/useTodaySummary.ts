export function useTodaySummary() {
  const today = useToday()
  const summary = useDaySummary(computed(() => today.value ?? ''), { immediate: false })
  // Nuxt only re-executes a key change when the fetch was immediate or had data, so the first fetch after today resolves has to be explicit.
  watch(
    today,
    (value) => {
      // every caller (layout badge, Today card) shares the key, so only the first one to see today's date fetches
      if (value !== null && summary.dayFetch.status.value === 'idle') summary.dayFetch.execute()
    },
    { immediate: true }
  )
  return summary
}
