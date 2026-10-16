export function useStepLoad(loader: () => Promise<void>) {
  const status = ref<'loading' | 'ready' | 'failed'>('loading')

  async function run() {
    status.value = 'loading'
    try {
      await loader()
      status.value = 'ready'
    } catch {
      status.value = 'failed'
    }
  }

  // apiFetch is the bare $fetch, which sends no cookies during SSR, so load after mount.
  onMounted(run)

  return { status, run }
}
