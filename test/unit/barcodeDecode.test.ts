import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

describe('decodeBarcode', () => {
  it('reads an EAN-13 fixture', async () => {
    const { decodeBarcode } = await import('../../app/utils/barcode/decode')
    const png = readFileSync('test/fixtures/barcodes/ean13-3017624010701.png')
    const hit = await decodeBarcode(png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength))
    expect(hit).toMatchObject({ text: '3017624010701', format: 'EAN-13' })
  })

  it('reads a UPC-A fixture as EAN-13 with the zero-padded GTIN', async () => {
    const { decodeBarcode } = await import('../../app/utils/barcode/decode')
    const png = readFileSync('test/fixtures/barcodes/upca-012345678905.png')
    const hit = await decodeBarcode(png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength))
    expect(hit).toMatchObject({ text: '0012345678905', format: 'EAN-13' })
  })

  it('returns null for an image with no barcode', async () => {
    const { decodeBarcode } = await import('../../app/utils/barcode/decode')
    const blank = new Uint8ClampedArray(64 * 64 * 4).fill(255)
    expect(await decodeBarcode({ data: blank, width: 64, height: 64, colorSpace: 'srgb' } as ImageData)).toBeNull()
  })
})

describe('browserOverrides', () => {
  it('always returns the given wasmUrl regardless of the requested file or prefix', async () => {
    const { browserOverrides } = await import('../../app/utils/barcode/decode')
    expect(browserOverrides('/x.wasm').locateFile('zxing_reader.wasm', 'https://ignored/')).toBe('/x.wasm')
  })
})

describe('ensureModule (isolated module instance, zxing-wasm/reader mocked)', () => {
  it('retries preparing the module after a rejection instead of caching the failure', async () => {
    const actual = await vi.importActual<typeof import('zxing-wasm/reader')>('zxing-wasm/reader')
    const prepareZXingModule = vi.fn(actual.prepareZXingModule).mockImplementationOnce(() => {
      throw new Error('boom')
    })
    vi.doMock('zxing-wasm/reader', () => ({ ...actual, prepareZXingModule }))
    vi.resetModules()

    const { decodeBarcode } = await import('../../app/utils/barcode/decode')
    const blank = new Uint8ClampedArray(64 * 64 * 4).fill(255)
    const input = { data: blank, width: 64, height: 64, colorSpace: 'srgb' } as ImageData

    await expect(decodeBarcode(input)).rejects.toThrow('boom')
    await expect(decodeBarcode(input)).resolves.toBeNull()

    vi.doUnmock('zxing-wasm/reader')
    vi.resetModules()
  })
})

describe('normalizeGtin', () => {
  it('pads UPC-A to GTIN-13', async () => {
    const { normalizeGtin } = await import('../../app/utils/barcode/decode')
    expect(normalizeGtin('012345678905')).toBe('0012345678905')
  })
  it('rejects a bad check digit', async () => {
    const { normalizeGtin } = await import('../../app/utils/barcode/decode')
    expect(() => normalizeGtin('3017624010702')).toThrow(/check digit/i)
  })
})
