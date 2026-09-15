// Mirrors Tailwind's sm breakpoint (40rem).
const NARROW_QUERY = '(max-width: 39.99rem)'

export function useIsNarrow() {
  const narrow = ref(false)
  let media: MediaQueryList | undefined

  function update(event: { matches: boolean }) {
    narrow.value = event.matches
  }

  onMounted(() => {
    media = window.matchMedia(NARROW_QUERY)
    update(media)
    media.addEventListener('change', update)
  })

  onBeforeUnmount(() => media?.removeEventListener('change', update))

  return narrow
}
