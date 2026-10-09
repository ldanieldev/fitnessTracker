import { describe, expect, it, vi } from 'vitest'
import { readStamped, type StampedEntry, type StampedStore } from '../../server/utils/cache/stampedCache'

function memoryStore<T>() {
  const items = new Map<string, StampedEntry<T>>()
  const ttls: number[] = []
  const store: StampedStore<T> = {
    get: async (key) => items.get(key) ?? null,
    set: async (key, entry, ttl) => {
      items.set(key, entry)
      ttls.push(ttl)
    }
  }
  return { items, ttls, store }
}

describe('readStamped', () => {
  it('serves a hit without recomputing', async () => {
    const { store } = memoryStore<number>()
    const compute = vi.fn(async () => 42)
    expect(await readStamped(store, 'k', 's1', 60, compute)).toBe(42)
    expect(await readStamped(store, 'k', 's1', 60, compute)).toBe(42)
    expect(compute).toHaveBeenCalledTimes(1)
  })

  it('recomputes on a new stamp and overwrites the same key', async () => {
    const { items, store } = memoryStore<number>()
    await readStamped(store, 'k', 's1', 60, async () => 1)
    expect(await readStamped(store, 'k', 's2', 60, async () => 2)).toBe(2)
    expect([...items.keys()]).toEqual(['k'])
    expect(items.get('k')?.stamp).toBe('s2')
  })

  it('recomputes after maxAge and hands maxAge to the store as the TTL', async () => {
    const { ttls, store } = memoryStore<number>()
    let clock = 1_000
    const now = () => clock
    const compute = vi.fn(async () => 7)
    await readStamped(store, 'k', 's', 60, compute, now)
    clock += 60_001
    await readStamped(store, 'k', 's', 60, compute, now)
    expect(compute).toHaveBeenCalledTimes(2)
    expect(ttls).toEqual([60, 60])
  })

  it('falls through to compute when the store fails', async () => {
    const store: StampedStore<number> = {
      get: async () => {
        throw new Error('down')
      },
      set: async () => {
        throw new Error('down')
      }
    }
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await readStamped(store, 'k', 's', 60, async () => 5)).toBe(5)
    expect(logged).toHaveBeenCalledTimes(2)
    logged.mockRestore()
  })
})
