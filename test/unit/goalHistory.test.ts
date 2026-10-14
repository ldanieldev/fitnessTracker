import { describe, expect, it } from 'vitest'
import { snapshotOn } from '../../shared/utils/goalHistory'

const rows = [
  { effectiveFrom: '1900-01-01', name: 'cut' },
  { effectiveFrom: '2026-10-11', name: 'break' },
  { effectiveFrom: '2026-10-25', name: 'cut 2' }
]

describe('snapshotOn', () => {
  it('picks the latest entry starting on or before the date', () => {
    expect(snapshotOn(rows, '2026-10-10')?.name).toBe('cut')
    expect(snapshotOn(rows, '2026-10-11')?.name).toBe('break')
    expect(snapshotOn(rows, '2026-10-24')?.name).toBe('break')
    expect(snapshotOn(rows, '2027-01-01')?.name).toBe('cut 2')
  })

  it('has nothing before the first entry or with no history', () => {
    expect(snapshotOn(rows.slice(1), '2026-10-10')).toBeNull()
    expect(snapshotOn([], '2026-10-10')).toBeNull()
  })
})
