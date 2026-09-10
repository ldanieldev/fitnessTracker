import { describe, expect, it } from 'vitest'

const catalogFood = { id: 7, name: 'Nutella', brand: 'Ferrero', barcode: '3017624010701', createdByUserId: null }
const ownFood = { id: 8, name: 'My oats', brand: null, barcode: null, createdByUserId: 42 }

describe('foodToSearchDocument', () => {
  it('marks catalogue rows and carries the source key', async () => {
    const { foodToSearchDocument } = await import('../../server/utils/nutrition/searchDocuments')
    const doc = foodToSearchDocument(catalogFood, ['100 g', 'serving'], 'off')
    expect(doc).toEqual({
      id: 7, name: 'Nutella', brand: 'Ferrero', source: 'off', barcode: '3017624010701',
      serving_labels: ['100 g', 'serving'], is_catalog: true, owner_id: null
    })
  })

  it('marks user-owned rows with their owner', async () => {
    const { foodToSearchDocument } = await import('../../server/utils/nutrition/searchDocuments')
    const doc = foodToSearchDocument(ownFood, [], 'user')
    expect(doc.is_catalog).toBe(false)
    expect(doc.owner_id).toBe(42)
  })
})

describe('visibilityFilter', () => {
  it('lets a user see catalogue rows plus their own', async () => {
    const { visibilityFilter } = await import('../../server/utils/nutrition/searchDocuments')
    expect(visibilityFilter(42)).toBe('is_catalog = true OR owner_id = 42')
  })
})
