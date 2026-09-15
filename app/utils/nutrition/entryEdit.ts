import type { DiaryEntry, DiaryEntryPatch } from '~~/app/composables/useDiaryDay'

export interface EntryDraft {
  quantity: number
  unitLabel: string
  containerId: number
  notes: string
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function timeOf(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function draftFromEntry(entry: DiaryEntry): EntryDraft {
  return {
    quantity: entry.quantity,
    unitLabel: entry.unitLabel,
    containerId: entry.containerId,
    notes: entry.notes ?? ''
  }
}

export function entryPatch(entry: DiaryEntry, draft: EntryDraft): DiaryEntryPatch {
  const patch: DiaryEntryPatch = {}
  if (draft.quantity !== entry.quantity) patch.quantity = draft.quantity
  if (entry.entryType === 'food' && draft.unitLabel !== entry.unitLabel) patch.unitLabel = draft.unitLabel
  if (draft.containerId !== entry.containerId) patch.containerId = draft.containerId
  const notes = draft.notes.trim() === '' ? null : draft.notes.trim()
  if (notes !== (entry.notes ?? null)) patch.notes = notes
  return patch
}

export function scaledPreview(nutrients: Record<string, number>, oldQuantity: number, newQuantity: number) {
  const ratio = oldQuantity > 0 ? newQuantity / oldQuantity : 0
  return Object.fromEntries(Object.entries(nutrients).map(([key, amount]) => [key, amount * ratio]))
}
