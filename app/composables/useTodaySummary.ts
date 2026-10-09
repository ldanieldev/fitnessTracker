export function useTodaySummary() {
  const today = useToday()
  const summary = useDaySummary(
    computed(() => today.value ?? ''),
    { immediate: false }
  )
  // Nuxt re-executes on a key change only if immediate or holding data, so the first post-today fetch is explicit.
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
