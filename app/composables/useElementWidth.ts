import type { Ref } from 'vue'

export function useElementWidth(el: Ref<HTMLElement | null>, fallback = 320) {
  const width = ref(fallback)
  let observer: ResizeObserver | undefined

  onMounted(() => {
    if (!el.value) return
    width.value = el.value.clientWidth || fallback
    if (typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width
      if (next) width.value = Math.round(next)
    })
    observer.observe(el.value)
  })

  onBeforeUnmount(() => observer?.disconnect())

  return width
}
