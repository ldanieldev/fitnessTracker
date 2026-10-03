import { describe, expect, it } from 'vitest'
import {
  groupItems, moveWithGroups, moveWithGroupsTo, nextAfterSet, normalizeGroups, supersetIndex, supersetLabel, ungroupItem
} from '../../shared/utils/supersets'

const item = (id: number, supersetGroup: number | null = null) => ({ id, supersetGroup })
const ids = (items: { id: number }[]) => items.map((i) => i.id)

describe('grouping', () => {
  it('groups picked items next to the first one, in list order, with a fresh number', () => {
    const items = [item(1), item(2), item(3, 1), item(4, 1), item(5)]
    const grouped = groupItems(items, [5, 1])
    expect(ids(grouped)).toEqual([1, 5, 2, 3, 4])
    expect(grouped.find((i) => i.id === 1)!.supersetGroup).toBe(2)
    expect(grouped.find((i) => i.id === 5)!.supersetGroup).toBe(2)
  })

  it('picking one member of a group brings the rest of that group along', () => {
    const grouped = groupItems([item(1, 1), item(2, 1), item(3)], [2, 3])
    expect(ids(grouped)).toEqual([1, 2, 3])
    expect(grouped.every((i) => i.supersetGroup === grouped[0]!.supersetGroup && i.supersetGroup !== null)).toBe(true)
  })

  it('adding to a superset keeps its other members', () => {
    const grouped = groupItems([item(1, 1), item(2, 1), item(3)], [3, 1])
    expect(ids(grouped)).toEqual([1, 2, 3])
    expect(new Set(grouped.map((i) => i.supersetGroup)).size).toBe(1)
    expect(grouped.every((i) => i.supersetGroup !== null)).toBe(true)
  })

  it('picking members of two groups merges both groups', () => {
    const grouped = groupItems([item(1, 1), item(2, 1), item(3, 2), item(4, 2), item(5)], [2, 4])
    expect(ids(grouped)).toEqual([1, 2, 3, 4, 5])
    expect(new Set(grouped.slice(0, 4).map((i) => i.supersetGroup)).size).toBe(1)
    expect(grouped[4]!.supersetGroup).toBeNull()
  })

  it('ungrouping moves the item just after its old group', () => {
    const items = [item(1, 1), item(2, 1), item(3, 1), item(4)]
    const out = ungroupItem(items, 1)
    expect(ids(out)).toEqual([2, 3, 1, 4])
    expect(out.find((i) => i.id === 1)!.supersetGroup).toBeNull()
  })

  it('normalize dissolves single-member groups', () => {
    expect(normalizeGroups([item(1, 4), item(2)])).toEqual([item(1), item(2)])
  })
})

describe('moving', () => {
  it('steps over a whole group', () => {
    const items = [item(1), item(2, 1), item(3, 1), item(4)]
    expect(ids(moveWithGroups(items, 1, 1))).toEqual([2, 3, 1, 4])
    expect(ids(moveWithGroups(items, 4, -1))).toEqual([1, 4, 2, 3])
  })

  it('keeps a grouped item inside its group', () => {
    const items = [item(1), item(2, 1), item(3, 1), item(4)]
    expect(ids(moveWithGroups(items, 2, 1))).toEqual([1, 3, 2, 4])
    expect(moveWithGroups(items, 2, -1)).toBe(items)
    expect(moveWithGroups(items, 3, 1)).toBe(items)
  })

  it('returns the same array at the ends', () => {
    const items = [item(1), item(2)]
    expect(moveWithGroups(items, 1, -1)).toBe(items)
    expect(moveWithGroups(items, 2, 1)).toBe(items)
  })

  it('moves to an absolute index one legal step at a time', () => {
    expect(ids(moveWithGroupsTo([item(1), item(2), item(3)], 3, 0))).toEqual([3, 1, 2])
    expect(ids(moveWithGroupsTo([item(1), item(2, 1), item(3, 1)], 1, 1))).toEqual([2, 3, 1])
  })
})

describe('labels', () => {
  it('letters groups by first appearance and numbers members', () => {
    const items = [item(1), item(2, 7), item(3, 7), item(4, 3), item(5, 3)]
    expect(supersetLabel(items, 2)).toBe('A1')
    expect(supersetLabel(items, 3)).toBe('A2')
    expect(supersetLabel(items, 5)).toBe('B2')
    expect(supersetLabel(items, 1)).toBeNull()
    expect(supersetIndex(items, 4)).toBe(1)
  })
})

describe('nextAfterSet', () => {
  const entry = (id: number, supersetGroup: number | null, setCount: number, targetSets: number | null) =>
    ({ id, supersetGroup, setCount, targetSets })

  it('jumps to the next member without rest mid-round', () => {
    const entries = [entry(1, 1, 1, 3), entry(2, 1, 0, 3), entry(3, null, 0, 3)]
    expect(nextAfterSet(entries, 1)).toEqual({ open: 2, rest: false, restFromEntryId: 1 })
  })

  it('rests after the round and goes back to the top', () => {
    const entries = [entry(1, 1, 1, 3), entry(2, 1, 1, 3)]
    expect(nextAfterSet(entries, 2)).toEqual({ open: 1, rest: true, restFromEntryId: 2 })
  })

  it('skips members that used up their targets', () => {
    const entries = [entry(1, 1, 2, 2), entry(2, 1, 2, 3), entry(3, 1, 2, 3)]
    expect(nextAfterSet(entries, 2)).toEqual({ open: 3, rest: false, restFromEntryId: 2 })
    expect(nextAfterSet(entries, 3)).toEqual({ open: 2, rest: true, restFromEntryId: 3 })
  })

  it('leaves the group when every member is done', () => {
    const entries = [entry(1, 1, 3, 3), entry(2, 1, 3, 3), entry(3, null, 0, 3)]
    expect(nextAfterSet(entries, 2)).toEqual({ open: 3, rest: true, restFromEntryId: 2 })
  })

  it('untargeted group cycles forever', () => {
    const entries = [entry(1, 1, 5, null), entry(2, 1, 4, null)]
    expect(nextAfterSet(entries, 1)).toEqual({ open: 2, rest: false, restFromEntryId: 1 })
    expect(nextAfterSet(entries, 2)).toEqual({ open: 1, rest: true, restFromEntryId: 2 })
  })

  it('opens the next unfinished exercise when an ungrouped one reaches its target', () => {
    const entries = [entry(1, null, 3, 3), entry(2, null, 3, 3), entry(3, null, 0, null)]
    expect(nextAfterSet(entries, 1)).toEqual({ open: 3, rest: true, restFromEntryId: 1 })
  })

  it('stays put below target or without one', () => {
    expect(nextAfterSet([entry(1, null, 1, 3), entry(2, null, 0, 3)], 1)).toEqual({ open: null, rest: true, restFromEntryId: 1 })
    expect(nextAfterSet([entry(1, null, 4, null), entry(2, null, 0, 3)], 1)).toEqual({ open: null, rest: true, restFromEntryId: 1 })
  })
})
