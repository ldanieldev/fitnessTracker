import { formatToLabel, prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { toGtin13 } from '~~/shared/utils/gtin'

const FORMATS = ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E'] as const

export function isSupportedBarcodeFormat(format: string): boolean {
  return (FORMATS as readonly string[]).includes(format)
}

let prepared: Promise<void> | undefined

export function browserOverrides(wasmUrl: string) {
  return { locateFile: () => wasmUrl }
}

// Node's fetch can't reach the wasm via file:// under vitest, so bytes are passed directly. node:fs/node:module are dynamic imports because Vite's dev server stubs node:module without createRequire.
async function ensureModule() {
  if (!prepared) {
    prepared = (async () => {
      if (typeof window === 'undefined') {
        const [{ readFileSync }, { createRequire }] = await Promise.all([import('node:fs'), import('node:module')])
        const wasmPath = createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm')
        prepareZXingModule({ overrides: { wasmBinary: readFileSync(wasmPath) } })
      } else {
        prepareZXingModule({ overrides: browserOverrides(wasmUrl) })
      }
    })().catch((err: unknown) => {
      prepared = undefined
      throw err
    })
  }
  await prepared
}

export async function decodeBarcode(input: ImageData | Blob | ArrayBuffer): Promise<{ text: string, format: string } | null> {
  await ensureModule()
  const results = await readBarcodes(input as never, { formats: [...FORMATS], maxNumberOfSymbols: 1 })
  const first = results[0]
  return first && first.text ? { text: first.text, format: formatToLabel(first.format) ?? first.format } : null
}

export function normalizeGtin(raw: string): string {
  const padded = toGtin13(raw)
  if (![8, 13, 14].includes(padded.length)) throw new Error('Unsupported barcode length')
  const body = padded.slice(0, -1)
  const check = Number(padded.at(-1))
  const sum = [...body].reverse().reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 3 : 1), 0)
  if ((10 - (sum % 10)) % 10 !== check) throw new Error('Invalid check digit')
  return padded
}
