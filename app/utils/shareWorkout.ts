export type ShareOutcome = 'shared' | 'copied' | 'manual' | 'cancelled'

export interface ShareNavigator {
  share?: (data: { text: string }) => Promise<void>
  clipboard?: { writeText?: (text: string) => Promise<void> }
}

// share and clipboard are [SecureContext] and need user activation, so plain-HTTP LAN or a slow fetch lands on manual.
export async function shareWorkout(
  text: string,
  nav: ShareNavigator | undefined = typeof navigator === 'undefined' ? undefined : navigator
): Promise<ShareOutcome> {
  if (typeof nav?.share === 'function') {
    try {
      await nav.share({ text })
      return 'shared'
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return 'cancelled'
    }
  }
  if (typeof nav?.clipboard?.writeText === 'function') {
    try {
      await nav.clipboard.writeText(text)
      return 'copied'
    } catch {
      return 'manual'
    }
  }
  return 'manual'
}
