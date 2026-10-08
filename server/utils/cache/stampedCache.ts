export interface StampedEntry<T> {
  stamp: string
  value: T
  expiresAt: number
}

export interface StampedStore<T> {
  get: (key: string) => Promise<StampedEntry<T> | null>
  set: (key: string, entry: StampedEntry<T>, ttlSeconds: number) => Promise<void>
}

// The stamp lives in the value, not the key, so newer history overwrites the entry instead of orphaning it until its TTL.
export async function readStamped<T>(
  store: StampedStore<T>,
  key: string,
  stamp: string,
  maxAgeSeconds: number,
  compute: () => Promise<T>,
  now: () => number = Date.now
): Promise<T> {
  const hit = await store.get(key).catch((error: unknown) => {
    console.error('[cache] read failed', key, error)
    return null
  })
  if (hit && hit.stamp === stamp && hit.expiresAt > now()) return hit.value
  const value = await compute()
  await store.set(key, { stamp, value, expiresAt: now() + maxAgeSeconds * 1000 }, maxAgeSeconds).catch((error: unknown) => {
    console.error('[cache] write failed', key, error)
  })
  return value
}
