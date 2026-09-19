import { ref, computed, readonly } from 'vue'

export function useRestTimer() {
  const isRunning = ref(false)
  const remainingSeconds = ref(0)
  const totalSeconds = ref(60)
  let intervalId: ReturnType<typeof setInterval> | null = null
  let endsAt = 0
  let completeCallback: (() => void) | null = null

  const progress = computed(() => {
    if (totalSeconds.value === 0 || remainingSeconds.value === 0) return 0
    return Math.round(((totalSeconds.value - remainingSeconds.value) / totalSeconds.value) * 100)
  })

  const display = computed(() => {
    const mins = Math.floor(remainingSeconds.value / 60)
    const secs = remainingSeconds.value % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  })

  function clearTimer() {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  function secondsLeft() {
    return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  }

  // Reads the clock instead of decrementing because browsers throttle intervals on hidden pages.
  function tick() {
    remainingSeconds.value = secondsLeft()
    if (remainingSeconds.value <= 0) {
      clearTimer()
      isRunning.value = false
      completeCallback?.()
    }
  }

  function run(seconds: number) {
    clearTimer()
    endsAt = Date.now() + seconds * 1000
    remainingSeconds.value = seconds
    isRunning.value = true
    intervalId = setInterval(tick, 1000)
  }

  function start(seconds: number) {
    totalSeconds.value = seconds
    run(seconds)
  }

  function skip() {
    clearTimer()
    isRunning.value = false
    remainingSeconds.value = 0
  }

  function reset() {
    run(totalSeconds.value)
  }

  function adjustTime(delta: number) {
    endsAt += delta * 1000
    remainingSeconds.value = secondsLeft()
    if (remainingSeconds.value === 0 && isRunning.value) {
      clearTimer()
      isRunning.value = false
    }
  }

  function setPreset(seconds: number) {
    start(seconds)
  }

  function onComplete(cb: () => void) {
    completeCallback = cb
  }

  return {
    isRunning: readonly(isRunning),
    remainingSeconds: readonly(remainingSeconds),
    totalSeconds: readonly(totalSeconds),
    progress,
    display,
    start,
    skip,
    reset,
    adjustTime,
    setPreset,
    onComplete
  }
}

export type RestTimer = ReturnType<typeof useRestTimer>
