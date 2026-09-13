import { todayDate } from '~~/shared/utils/nutritionSummary'
import { msUntilNextMidnight } from '~/utils/nutrition/today'

export default defineNuxtPlugin(() => {
  const today = useToday()

  function tick() {
    today.value = todayDate()
    // +1s buffer past midnight so timer drift never re-fires while still the previous day.
    setTimeout(tick, msUntilNextMidnight(new Date()) + 1000)
  }

  // app:mounted fires before the page's Suspense hydrates the layout, so setting today there mismatches the SSR badge; onNuxtReady waits for it.
  onNuxtReady(tick)
})
