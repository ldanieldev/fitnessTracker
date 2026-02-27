import { ref, computed, readonly } from 'vue'

export function useRestTimer() {
  const isRunning = ref(false)
  const remainingSeconds = ref(0)
  const totalSeconds = ref(60)
  let intervalId: ReturnType<typeof setInterval> | null = null
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

  function tick() {
    if (remainingSeconds.value <= 0) {
      clearTimer()
      isRunning.value = false
      completeCallback?.()
      return
    }
    remainingSeconds.value--
    if (remainingSeconds.value <= 0) {
      clearTimer()
      isRunning.value = false
      completeCallback?.()
    }
  }

  function start(seconds: number) {
    clearTimer()
    totalSeconds.value = seconds
    remainingSeconds.value = seconds
    isRunning.value = true
    intervalId = setInterval(tick, 1000)
  }

  function skip() {
    clearTimer()
    isRunning.value = false
    remainingSeconds.value = 0
  }

  function reset() {
    clearTimer()
    remainingSeconds.value = totalSeconds.value
    isRunning.value = true
    intervalId = setInterval(tick, 1000)
  }

  function adjustTime(delta: number) {
    remainingSeconds.value = Math.max(0, remainingSeconds.value + delta)
    if (remainingSeconds.value === 0 && isRunning.value) {
      clearTimer()
      isRunning.value = false
    }
  }

  function setPreset(seconds: number) {
    clearTimer()
    totalSeconds.value = seconds
    remainingSeconds.value = seconds
    isRunning.value = true
    intervalId = setInterval(tick, 1000)
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
