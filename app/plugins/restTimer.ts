export default defineNuxtPlugin(() => {
  const timer = useRestTimer()
  const toast = useToast()
  timer.onComplete(() => {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    toast.add({ title: 'Rest complete!', icon: 'i-lucide-timer', color: 'success' })
  })
  return { provide: { restTimer: timer } }
})
