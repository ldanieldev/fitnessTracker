export interface GoogleHealthGranted {
  sleep: boolean
  metrics: boolean
  activity: boolean
  weightWrite: boolean
}

export interface GoogleHealthConnectionStatus {
  email: string
  status: 'active' | 'reconnect_required'
  lastSyncedAt: string | null
  lastError: string | null
  syncSteps: boolean
  pushWeight: boolean
  granted: GoogleHealthGranted
}

export interface GoogleHealthStatus {
  available: boolean
  connection: GoogleHealthConnectionStatus | null
}

export interface SyncCounts {
  hrv: number
  restingHr: number
  sleep: number
  steps: number
}

export type SyncResult =
  | { outcome: 'ok'; counts: SyncCounts; errors: string[] }
  | { outcome: 'busy' }
  | { outcome: 'not_connected' }
  | { outcome: 'reconnect_required' }
