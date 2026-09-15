import { describe, expect, it } from 'vitest'

describe('saveAsSummary', () => {
  it('reports skipped quick-adds and flattened recipes only when present', async () => {
    const { saveAsSummary } = await import('../../app/utils/nutrition/saveAs')
    expect(saveAsSummary(0, 0)).toBe('Saved')
    expect(saveAsSummary(1, 0)).toBe('Saved · 1 quick-add skipped')
    expect(saveAsSummary(2, 3)).toBe('Saved · 2 quick-adds skipped · 3 recipes flattened')
    expect(saveAsSummary(0, 1)).toBe('Saved · 1 recipe flattened')
  })
})
