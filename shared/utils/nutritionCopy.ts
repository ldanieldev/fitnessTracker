export interface CopySourceEntry {
  id: number
  containerId: number
  quantity: number
  unitLabel: string
}

export interface CopyOverride {
  sourceEntryId: number
  quantity?: number
  unitLabel?: string
  exclude?: boolean
}

export interface CopyPlanItem {
  sourceEntryId: number
  containerId: number
  quantity: number
  unitLabel: string
}

export function applyOverrides(
  entries: CopySourceEntry[],
  overrides: CopyOverride[],
  targetContainerId: number | null
): CopyPlanItem[] {
  const byId = new Map(overrides.map((o) => [o.sourceEntryId, o]))

  const plan = entries.flatMap((entry) => {
    const override = byId.get(entry.id)
    if (override?.exclude) return []
    const quantity = override?.quantity ?? entry.quantity
    if (!(quantity > 0)) {
      throw new Error('Override quantity must be positive')
    }
    return [{
      sourceEntryId: entry.id,
      containerId: targetContainerId ?? entry.containerId,
      quantity,
      unitLabel: override?.unitLabel ?? entry.unitLabel
    }]
  })

  if (plan.length === 0) {
    throw new Error('Nothing to copy: every entry was excluded')
  }
  return plan
}
