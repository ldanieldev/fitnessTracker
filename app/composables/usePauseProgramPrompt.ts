import { todayDate } from '~~/shared/utils/nutritionSummary'

export function usePauseProgramPrompt() {
  const today = useToday()
  const open = ref(false)
  const programName = ref('')
  let retry: (() => Promise<void>) | null = null

  watch(open, (isOpen) => {
    if (!isOpen) retry = null
  })

  async function guarded<T>(attempt: (extra: Record<string, unknown>) => Promise<T>, done: (value: T) => unknown) {
    try {
      await done(await attempt({ today: today.value ?? todayDate() }))
    } catch (err: unknown) {
      const data = (err as { data?: { data?: { code?: string; program?: { name: string } } } }).data?.data
      if (data?.code !== 'program_controls_routine') throw err
      programName.value = data.program?.name ?? 'Your program'
      retry = async () => {
        await done(await attempt({ pauseProgram: true, today: today.value ?? todayDate() }))
      }
      open.value = true
    }
  }

  async function confirm() {
    open.value = false
    const pending = retry
    retry = null
    if (pending) await pending()
  }

  return { open, programName, guarded, confirm }
}
