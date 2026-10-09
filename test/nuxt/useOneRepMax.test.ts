import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { useOneRepMax } from '../../app/composables/useOneRepMax'

const estimate = (value: number) => ({
  estimate: value,
  source: { weight: 225, reps: 5, performedOn: '2026-09-02' },
  assisted: false
})

function gate() {
  let open!: () => void
  const opened = new Promise<void>((resolve) => {
    open = resolve
  })
  return { open, opened }
}

describe('useOneRepMax', () => {
  it('ignores a response that a newer load superseded', async () => {
    const slow = gate()
    registerEndpoint('/api/workouts/exercises/901/one-rep-max', async () => {
      await slow.opened
      return estimate(100)
    })
    registerEndpoint('/api/workouts/exercises/902/one-rep-max', () => estimate(200))
    const id = ref<number | null>(901)
    const oneRepMax = useOneRepMax(id)
    const stale = oneRepMax.load()
    id.value = 902
    await oneRepMax.load()
    slow.open()
    await stale
    expect(oneRepMax.result.value?.estimate).toBe(200)
    expect(oneRepMax.pending.value).toBe(false)
  })

  it('keeps the last result while it refetches the same exercise', async () => {
    let calls = 0
    const slow = gate()
    registerEndpoint('/api/workouts/exercises/903/one-rep-max', async () => {
      calls += 1
      if (calls > 1) await slow.opened
      return estimate(150 + calls)
    })
    const oneRepMax = useOneRepMax(ref(903))
    await oneRepMax.load()
    const again = oneRepMax.load()
    expect(oneRepMax.pending.value).toBe(true)
    expect(oneRepMax.result.value?.estimate).toBe(151)
    slow.open()
    await again
    expect(oneRepMax.result.value?.estimate).toBe(152)
  })

  it('blanks the result when the exercise changes', async () => {
    const slow = gate()
    registerEndpoint('/api/workouts/exercises/904/one-rep-max', () => estimate(120))
    registerEndpoint('/api/workouts/exercises/905/one-rep-max', async () => {
      await slow.opened
      return estimate(130)
    })
    const id = ref<number | null>(904)
    const oneRepMax = useOneRepMax(id)
    await oneRepMax.load()
    id.value = 905
    const next = oneRepMax.load()
    expect(oneRepMax.result.value).toBeNull()
    slow.open()
    await next
    expect(oneRepMax.result.value?.estimate).toBe(130)
  })
})
