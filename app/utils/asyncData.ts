// A key ending in ':' is a prefix matching every mounted fetch under it (logged weeks, days).
export function mountedAsyncDataKeys(keys: string[]): string[] {
  const mounted = Object.keys(useNuxtApp()._asyncData ?? {})
  return mounted.filter((key) => keys.some((k) => (k.endsWith(':') ? key.startsWith(k) : key === k)))
}

// dedupe 'cancel': a 'defer' fetch (or refreshNuxtData) would hand back an invalidated key's stale in-flight promise.
export async function executeAsyncData(keys: string[]) {
  const nuxtApp = useNuxtApp()
  await Promise.all(mountedAsyncDataKeys(keys).map((key) => nuxtApp._asyncData[key]?.execute({ dedupe: 'cancel' })))
}
