import { describe, expect, it } from 'vitest'
import { exportFilename, exportQuerySchema } from '../../server/utils/export/range'

describe('exportQuerySchema', () => {
  it.each([
    [{}, true],
    [{ from: '2026-10-01' }, true],
    [{ to: '2026-10-07' }, true],
    [{ from: '2026-10-01', to: '2026-10-07' }, true],
    [{ from: '2026-10-07', to: '2026-10-07' }, true],
    [{ from: '2026-10-08', to: '2026-10-07' }, false],
    [{ from: '2026-13-01' }, false],
    [{ from: 'last week' }, false]
  ])('%o valid=%s', (query, valid) => {
    expect(exportQuerySchema.safeParse(query).success).toBe(valid)
  })
})

describe('exportFilename', () => {
  it.each([
    [{}, 'my-fitness-journal-2026-10-14.json'],
    [{ from: '2026-10-01', to: '2026-10-07' }, 'my-fitness-journal-2026-10-14-2026-10-01_2026-10-07.json'],
    [{ from: '2026-10-01' }, 'my-fitness-journal-2026-10-14-2026-10-01_2026-10-14.json'],
    [{ to: '2026-10-07' }, 'my-fitness-journal-2026-10-14-start_2026-10-07.json']
  ])('%o → %s', (range, name) => {
    expect(exportFilename('2026-10-14', range)).toBe(name)
  })
})
