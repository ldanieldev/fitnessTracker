import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('useRestTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize with default values', async () => {
    const { useRestTimer } = await import('../../app/composables/useRestTimer')
    const timer = useRestTimer()

    expect(timer.isRunning.value).toBe(false)
    expect(timer.remainingSeconds.value).toBe(0)
    expect(timer.totalSeconds.value).toBe(60)
    expect(timer.progress.value).toBe(0)
  })

  it('should start countdown and tick down', async () => {
    const { useRestTimer } = await import('../../app/composables/useRestTimer')
    const timer = useRestTimer()

    timer.start(60)
    expect(timer.isRunning.value).toBe(true)
    expect(timer.remainingSeconds.value).toBe(60)

    vi.advanceTimersByTime(1000)
    expect(timer.remainingSeconds.value).toBe(59)

    vi.advanceTimersByTime(5000)
    expect(timer.remainingSeconds.value).toBe(54)
  })

  it('should stop at zero and emit complete', async () => {
    const { useRestTimer } = await import('../../app/composables/useRestTimer')
    const timer = useRestTimer()
    const onComplete = vi.fn()
    timer.onComplete(onComplete)

    timer.start(3)
    vi.advanceTimersByTime(3000)

    expect(timer.remainingSeconds.value).toBe(0)
    expect(timer.isRunning.value).toBe(false)
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('should skip (stop immediately)', async () => {
    const { useRestTimer } = await import('../../app/composables/useRestTimer')
    const timer = useRestTimer()

    timer.start(60)
    timer.skip()

    expect(timer.isRunning.value).toBe(false)
    expect(timer.remainingSeconds.value).toBe(0)
  })

  it('should reset to current total', async () => {
    const { useRestTimer } = await import('../../app/composables/useRestTimer')
    const timer = useRestTimer()

    timer.start(60)
    vi.advanceTimersByTime(10000)
    timer.reset()

    expect(timer.remainingSeconds.value).toBe(60)
    expect(timer.isRunning.value).toBe(true)
  })

  it('should adjust time with +5 / -5', async () => {
    const { useRestTimer } = await import('../../app/composables/useRestTimer')
    const timer = useRestTimer()

    timer.start(60)
    timer.adjustTime(5)
    expect(timer.remainingSeconds.value).toBe(65)

    timer.adjustTime(-5)
    expect(timer.remainingSeconds.value).toBe(60)
  })

  it('should clamp adjusted time at 0', async () => {
    const { useRestTimer } = await import('../../app/composables/useRestTimer')
    const timer = useRestTimer()

    timer.start(3)
    timer.adjustTime(-10)
    expect(timer.remainingSeconds.value).toBe(0)
  })

  it('should set preset duration', async () => {
    const { useRestTimer } = await import('../../app/composables/useRestTimer')
    const timer = useRestTimer()

    timer.start(60)
    vi.advanceTimersByTime(10000)
    timer.setPreset(90)

    expect(timer.totalSeconds.value).toBe(90)
    expect(timer.remainingSeconds.value).toBe(90)
    expect(timer.isRunning.value).toBe(true)
  })

  it('should calculate progress as percentage', async () => {
    const { useRestTimer } = await import('../../app/composables/useRestTimer')
    const timer = useRestTimer()

    timer.start(100)
    vi.advanceTimersByTime(50000)

    expect(timer.progress.value).toBe(50)
  })

  it('should format display as MM:SS', async () => {
    const { useRestTimer } = await import('../../app/composables/useRestTimer')
    const timer = useRestTimer()

    timer.start(125)
    expect(timer.display.value).toBe('02:05')

    vi.advanceTimersByTime(60000)
    expect(timer.display.value).toBe('01:05')
  })
})
