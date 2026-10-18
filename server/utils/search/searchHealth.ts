import { logger } from '../logger'
import type { MeiliErrorSummary } from './meiliIndex'

const log = logger.child({ component: 'search' })

export interface SearchHealthTracker {
  up(): void
  down(reason: string, err?: MeiliErrorSummary): void
}

// Starts healthy so a Meilisearch that is already down at boot still logs one warn.
export function createSearchHealthTracker(index: string, degradedMessage: string): SearchHealthTracker {
  let healthy = true
  return {
    up() {
      if (healthy) return
      healthy = true
      log.info({ index }, 'Meilisearch recovered')
    },
    down(reason, err) {
      if (!healthy) return
      healthy = false
      log.warn({ index, reason, err }, degradedMessage)
    }
  }
}
