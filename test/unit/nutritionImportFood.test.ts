import { describe, expect, it, vi } from 'vitest'
import type { RootDbClient } from '../../server/utils/db'
import { importBarcodeKey, insertOrRecover, resolveImportTarget } from '../../server/utils/nutrition/importFood'

describe('importBarcodeKey', () => {
  it('returns null when the external food has no barcode', () => {
    expect(importBarcodeKey({ barcode: null })).toBeNull()
  })
})

describe('resolveImportTarget', () => {
  it('reuses the existing catalogue/owned row found by (sourceId, externalId)', () => {
    expect(resolveImportTarget({ existingBySource: { id: 1 }, existingByBarcode: null, persistable: true }))
      .toEqual({ action: 'reuse', id: 1 })
  })

  it('prefers the by-source match over a by-barcode match when both exist', () => {
    expect(resolveImportTarget({ existingBySource: { id: 1 }, existingByBarcode: { id: 2 }, persistable: true }))
      .toEqual({ action: 'reuse', id: 1 })
  })

  it('falls back to a catalogue row sharing the same barcode when no by-source match exists', () => {
    expect(resolveImportTarget({ existingBySource: null, existingByBarcode: { id: 2 }, persistable: true }))
      .toEqual({ action: 'reuse', id: 2 })
  })

  it('creates a new catalogue row when persistable and nothing to reuse', () => {
    expect(resolveImportTarget({ existingBySource: null, existingByBarcode: null, persistable: true }))
      .toEqual({ action: 'create-catalog' })
  })

  it('creates a user-owned row for a non-persistable source (fatsecret) when nothing to reuse', () => {
    expect(resolveImportTarget({ existingBySource: null, existingByBarcode: null, persistable: false }))
      .toEqual({ action: 'create-owned' })
  })
})

function fakeDb(transaction: RootDbClient['transaction']): RootDbClient {
  return { transaction } as unknown as RootDbClient
}

function uniqueViolation() {
  return Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })
}

describe('insertOrRecover', () => {
  it('recovers via lookup on a unique violation, without retrying the insert', async () => {
    const insert = vi.fn().mockRejectedValue(uniqueViolation())
    const recover = vi.fn().mockResolvedValue({ id: 42 })
    const result = await insertOrRecover(fakeDb((fn) => fn(undefined as never)), insert, recover)
    expect(result).toEqual({ id: 42 })
    expect(insert).toHaveBeenCalledTimes(1)
    expect(recover).toHaveBeenCalledTimes(1)
  })

  it('recovers via a unique violation nested in .cause', async () => {
    const wrapped = Object.assign(new Error('transaction rolled back'), { cause: uniqueViolation() })
    const insert = vi.fn().mockRejectedValue(wrapped)
    const recover = vi.fn().mockResolvedValue({ id: 7 })
    const result = await insertOrRecover(fakeDb((fn) => fn(undefined as never)), insert, recover)
    expect(result).toEqual({ id: 7 })
  })

  it('rethrows a non-unique-violation error without calling recover', async () => {
    const insert = vi.fn().mockRejectedValue(new Error('connection reset'))
    const recover = vi.fn()
    await expect(insertOrRecover(fakeDb((fn) => fn(undefined as never)), insert, recover)).rejects.toThrow('connection reset')
    expect(recover).not.toHaveBeenCalled()
  })

  it('rethrows the original unique-violation error when recovery finds nothing', async () => {
    const insert = vi.fn().mockRejectedValue(uniqueViolation())
    const recover = vi.fn().mockResolvedValue(null)
    await expect(insertOrRecover(fakeDb((fn) => fn(undefined as never)), insert, recover)).rejects.toThrow(
      'duplicate key value violates unique constraint'
    )
  })

  it('returns the inserted value directly when there is no conflict', async () => {
    const insert = vi.fn().mockResolvedValue({ id: 1 })
    const recover = vi.fn()
    const result = await insertOrRecover(fakeDb((fn) => fn(undefined as never)), insert, recover)
    expect(result).toEqual({ id: 1 })
    expect(recover).not.toHaveBeenCalled()
  })
})
