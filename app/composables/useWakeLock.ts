import { ref, readonly } from 'vue'

// The browser drops the lock whenever the page is hidden, so it is re-requested on return
export function useWakeLock() {
  const isSupported = ref(false)
  const active = ref(false)
  let wanted = false
  let sentinel: WakeLockSentinel | null = null

  async function acquire() {
    if (sentinel || document.visibilityState !== 'visible') return
    try {
      const lock = await navigator.wakeLock.request('screen')
      if (!wanted) {
        await lock.release()
        return
      }
      sentinel = lock
      active.value = true
      lock.addEventListener('release', () => {
        if (sentinel === lock) sentinel = null
        active.value = false
      })
    } catch {
      active.value = false
    }
  }

  function onVisibilityChange() {
    if (wanted) acquire()
  }

  async function enable() {
    isSupported.value = 'wakeLock' in navigator
    if (!isSupported.value) return
    if (!wanted) {
      wanted = true
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
    await acquire()
  }

  async function disable() {
    wanted = false
    document.removeEventListener('visibilitychange', onVisibilityChange)
    const lock = sentinel
    sentinel = null
    active.value = false
    await lock?.release()
  }

  return {
    isSupported: readonly(isSupported),
    active: readonly(active),
    enable,
    disable
  }
}
