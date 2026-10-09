export interface GroupItem {
  id: number
  supersetGroup: number | null
}

export interface FlowEntry extends GroupItem {
  setCount: number
  targetSets: number | null
}

export interface SetFlow {
  open: number | null
  rest: boolean
  restFromEntryId: number
}

export function normalizeGroups<T extends GroupItem>(items: T[]): T[] {
  const counts = new Map<number, number>()
  for (const item of items) {
    if (item.supersetGroup !== null) counts.set(item.supersetGroup, (counts.get(item.supersetGroup) ?? 0) + 1)
  }
  return items.map((item) =>
    item.supersetGroup !== null && counts.get(item.supersetGroup)! < 2 ? { ...item, supersetGroup: null } : item
  )
}

function contiguous<T extends GroupItem>(items: T[]): T[] {
  const out: T[] = []
  const placed = new Set<number>()
  for (const item of items) {
    if (placed.has(item.id)) continue
    const members = item.supersetGroup === null ? [item] : items.filter((m) => m.supersetGroup === item.supersetGroup)
    for (const member of members) {
      if (placed.has(member.id)) continue
      out.push(member)
      placed.add(member.id)
    }
  }
  return out
}

export function groupItems<T extends GroupItem>(items: T[], ids: number[]): T[] {
  const pickedGroups = new Set(items.filter((item) => ids.includes(item.id)).map((item) => item.supersetGroup))
  const picked = new Set(
    items
      .filter((item) => ids.includes(item.id) || (item.supersetGroup !== null && pickedGroups.has(item.supersetGroup)))
      .map((item) => item.id)
  )
  const anchor = items.findIndex((item) => picked.has(item.id))
  if (anchor === -1) return items
  const group = Math.max(0, ...items.map((item) => item.supersetGroup ?? 0)) + 1
  const members = items.filter((item) => picked.has(item.id)).map((item) => ({ ...item, supersetGroup: group }))
  const rest = items.filter((item) => !picked.has(item.id))
  const insertAt = items.slice(0, anchor).filter((item) => !picked.has(item.id)).length
  return normalizeGroups(contiguous([...rest.slice(0, insertAt), ...members, ...rest.slice(insertAt)]))
}

export function ungroupItem<T extends GroupItem>(items: T[], id: number): T[] {
  const item = items.find((candidate) => candidate.id === id)
  if (!item || item.supersetGroup === null) return items
  const without = items.filter((candidate) => candidate.id !== id)
  const lastIndex = without.findLastIndex((candidate) => candidate.supersetGroup === item.supersetGroup)
  without.splice(lastIndex + 1, 0, { ...item, supersetGroup: null })
  return normalizeGroups(without)
}

export function moveWithGroups<T extends GroupItem>(items: T[], id: number, delta: -1 | 1): T[] {
  const index = items.findIndex((item) => item.id === id)
  const item = items[index]
  const neighbour = items[index + delta]
  if (!item || !neighbour) return items
  const out = [...items]
  if (item.supersetGroup !== null || neighbour.supersetGroup === null) {
    if (item.supersetGroup !== null && neighbour.supersetGroup !== item.supersetGroup) return items
    out[index] = neighbour
    out[index + delta] = item
    return out
  }
  let end = index + delta
  while (items[end + delta]?.supersetGroup === neighbour.supersetGroup) end += delta
  out.splice(index, 1)
  out.splice(end, 0, item)
  return out
}

export function moveWithGroupsTo<T extends GroupItem>(items: T[], id: number, index: number): T[] {
  let current = items
  for (;;) {
    const position = current.findIndex((item) => item.id === id)
    if (position === -1 || position === index) return current
    const next = moveWithGroups(current, id, index > position ? 1 : -1)
    if (next === current) return current
    const moved = next.findIndex((item) => item.id === id)
    current = next
    if ((index > position && moved >= index) || (index < position && moved <= index)) return current
  }
}

function groupOrder(items: GroupItem[]): number[] {
  const order: number[] = []
  for (const item of items) {
    if (item.supersetGroup !== null && !order.includes(item.supersetGroup)) order.push(item.supersetGroup)
  }
  return order
}

export function supersetIndex(items: GroupItem[], id: number): number | null {
  const item = items.find((candidate) => candidate.id === id)
  if (!item || item.supersetGroup === null) return null
  return groupOrder(items).indexOf(item.supersetGroup)
}

export function supersetLabel(items: GroupItem[], id: number): string | null {
  const index = supersetIndex(items, id)
  if (index === null) return null
  const group = items.find((item) => item.id === id)!.supersetGroup
  const position = items.filter((item) => item.supersetGroup === group).findIndex((item) => item.id === id)
  return `${String.fromCharCode(65 + (index % 26))}${position + 1}`
}

const hasSetsLeft = (entry: FlowEntry) => entry.targetSets === null || entry.setCount < entry.targetSets
const unfinished = (entry: FlowEntry) =>
  entry.targetSets !== null ? entry.setCount < entry.targetSets : entry.setCount === 0

export function nextAfterSet(entries: FlowEntry[], loggedEntryId: number): SetFlow {
  const index = entries.findIndex((entry) => entry.id === loggedEntryId)
  const logged = entries[index]
  if (!logged) return { open: null, rest: true, restFromEntryId: loggedEntryId }
  if (logged.supersetGroup === null) {
    const reached = logged.targetSets !== null && logged.setCount === logged.targetSets
    const next = reached ? entries.slice(index + 1).find(unfinished) : undefined
    return { open: next?.id ?? null, rest: true, restFromEntryId: loggedEntryId }
  }
  const members = entries.filter((entry) => entry.supersetGroup === logged.supersetGroup)
  const position = members.findIndex((entry) => entry.id === loggedEntryId)
  const later = members.slice(position + 1).find(hasSetsLeft)
  if (later) return { open: later.id, rest: false, restFromEntryId: loggedEntryId }
  const first = members.find(hasSetsLeft)
  if (first) return { open: first.id, rest: true, restFromEntryId: loggedEntryId }
  const lastIndex = entries.findLastIndex((entry) => entry.supersetGroup === logged.supersetGroup)
  const after = entries.slice(lastIndex + 1).find(unfinished)
  return { open: after?.id ?? null, rest: true, restFromEntryId: loggedEntryId }
}
