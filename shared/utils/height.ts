export const HEIGHT_MIN_IN = 36
export const HEIGHT_MAX_IN = 96

export function splitHeight(inches: number | null): { feet: number | null; inches: number | null } {
  if (inches === null) return { feet: null, inches: null }
  const feet = Math.floor(inches / 12)
  return { feet, inches: Math.round((inches - feet * 12) * 10) / 10 }
}

export function joinHeight(feet: number | null | undefined, inches: number | null | undefined): number | null {
  if (feet == null && inches == null) return null
  return Math.round(((feet ?? 0) * 12 + (inches ?? 0)) * 10) / 10
}
