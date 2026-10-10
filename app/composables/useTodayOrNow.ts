import { todayDate } from '~~/shared/utils/nutritionSummary'

// useState carries the server's day into hydration so a browser in another timezone refetches once useToday() resolves.
export function useTodayOrNow() {
  const today = useToday()
  const to = useState('todayOrNow', () => todayDate())
  watch(
    today,
    (value) => {
      if (value && value !== to.value) to.value = value
    },
    { immediate: true }
  )
  return to
}
