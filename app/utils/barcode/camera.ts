const CLOSE_FOCUS_M = 0.2

export interface CameraProbe {
  deviceId: string
  minFocusM?: number
}

export function focusesClose(minFocusM: number | undefined): boolean {
  return minFocusM === undefined || minFocusM <= CLOSE_FOCUS_M
}

// Largest close-focus minimum wins: ultrawide/macro lenses focus closer than the main lens but shrink the barcode.
export function pickScanCamera(probes: CameraProbe[]): string | undefined {
  let best: { deviceId: string; minFocusM: number } | undefined
  for (const { deviceId, minFocusM } of probes) {
    if (minFocusM === undefined || minFocusM > CLOSE_FOCUS_M) continue
    if (!best || minFocusM > best.minFocusM) best = { deviceId, minFocusM }
  }
  return best?.deviceId
}

export function nextCamera(ids: string[], current: string | undefined): string | undefined {
  if (ids.length === 0) return undefined
  const index = current === undefined ? -1 : ids.indexOf(current)
  return ids[(index + 1) % ids.length]
}
