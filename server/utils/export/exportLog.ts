import { logger } from '../logger'

const log = logger.child({ component: 'export' })

export interface ExportLogFields {
  userId: number
  kind: 'account' | 'diary' | 'sessions' | 'program'
  ranged: boolean
  rows: number
  bytes?: number
  startedAt: number
  [extra: string]: unknown
}

export function logExport({ startedAt, ...fields }: ExportLogFields): void {
  log.info({ ...fields, durationMs: Math.round(performance.now() - startedAt) }, 'data export served')
}
