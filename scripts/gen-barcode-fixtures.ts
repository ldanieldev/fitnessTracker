import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { prepareZXingModule, writeBarcode } from 'zxing-wasm/writer'

const wasmPath = createRequire(import.meta.url).resolve('zxing-wasm/writer/zxing_writer.wasm')
prepareZXingModule({ overrides: { locateFile: () => `file://${wasmPath}` } })

const fixtures = [
  { name: 'ean13-3017624010701.png', text: '3017624010701', format: 'EAN-13' },
  { name: 'upca-012345678905.png', text: '012345678905', format: 'UPC-A' }
] as const

mkdirSync('test/fixtures/barcodes', { recursive: true })

for (const { name, text, format } of fixtures) {
  const result = await writeBarcode(text, { format })
  if (!result.image) throw new Error(`failed to write ${name}: ${result.error}`)
  writeFileSync(`test/fixtures/barcodes/${name}`, Buffer.from(await result.image.arrayBuffer()))
  console.log(`wrote test/fixtures/barcodes/${name}`)
}
