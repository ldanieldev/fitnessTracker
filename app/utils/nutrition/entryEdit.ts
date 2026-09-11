import type { DiaryEntry, DiaryEntryPatch } from '~~/app/composables/useDiaryDay'

export interface EntryDraft {
  quantity: number
  unitLabel: string
  containerId: number
  time: string
  notes: string
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function timeOf(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function mergeTime(iso: string, time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const d = new Date(iso)
  d.setHours(hours!, minutes!, 0, 0)
  return d.toISOString()
}

export function draftFromEntry(entry: DiaryEntry): EntryDraft {
  return {
    quantity: entry.quantity,
    unitLabel: entry.unitLabel,
    containerId: entry.containerId,
    time: timeOf(entry.loggedAt),
    notes: entry.notes ?? ''
  }
}

export function entryPatch(entry: DiaryEntry, draft: EntryDraft): DiaryEntryPatch {
  const patch: DiaryEntryPatch = {}
  if (draft.quantity !== entry.quantity) patch.quantity = draft.quantity
  if (entry.entryType === 'food' && draft.unitLabel !== entry.unitLabel) patch.unitLabel = draft.unitLabel
  if (draft.containerId !== entry.containerId) patch.containerId = draft.containerId
  if (/^\d{2}:\d{2}$/.test(draft.time) && draft.time !== timeOf(entry.loggedAt)) patch.loggedAt = mergeTime(entry.loggedAt, draft.time)
  const notes = draft.notes.trim() === '' ? null : draft.notes.trim()
  if (notes !== (entry.notes ?? null)) patch.notes = notes
  return patch
}

export function scaledPreview(nutrients: Record<string, number>, oldQuantity: number, newQuantity: number) {
  const ratio = oldQuantity > 0 ? newQuantity / oldQuantity : 0
  return Object.fromEntries(Object.entries(nutrients).map(([key, amount]) => [key, amount * ratio]))
}
