import { expect, vi } from 'vitest'
import { useToday } from '../../app/composables/useToday'

// The today plugin overwrites useToday() on its first onNuxtReady tick; waiting for it lets a test's own today stick.
export function waitForTodayTick() {
  return vi.waitFor(() => expect(useToday().value).not.toBeNull())
}
