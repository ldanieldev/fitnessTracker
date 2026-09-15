import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const OUT_DIR = 'public/ocr'
const ENG_TRAINEDDATA_URL = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'

mkdirSync(OUT_DIR, { recursive: true })

const copies = [
  { from: require.resolve('tesseract.js/dist/worker.min.js'), to: `${OUT_DIR}/worker.min.js` },
  { from: require.resolve('tesseract.js-core/tesseract-core-lstm.wasm.js'), to: `${OUT_DIR}/tesseract-core-lstm.wasm.js` },
  { from: require.resolve('tesseract.js-core/tesseract-core-lstm.wasm'), to: `${OUT_DIR}/tesseract-core-lstm.wasm` }
]

for (const { from, to } of copies) {
  copyFileSync(from, to)
  console.log(`copied ${to} (${statSync(to).size} bytes)`)
}

if (existsSync(`${OUT_DIR}/eng.traineddata.gz`)) {
  console.log(`skipped eng.traineddata.gz (already present, ${statSync(`${OUT_DIR}/eng.traineddata.gz`).size} bytes)`)
} else {
  const response = await fetch(ENG_TRAINEDDATA_URL)
  if (!response.ok) throw new Error(`failed to download ${ENG_TRAINEDDATA_URL}: ${response.status}`)
  writeFileSync(`${OUT_DIR}/eng.traineddata.gz`, Buffer.from(await response.arrayBuffer()))
  console.log(`downloaded ${OUT_DIR}/eng.traineddata.gz (${statSync(`${OUT_DIR}/eng.traineddata.gz`).size} bytes) from ${ENG_TRAINEDDATA_URL}`)
}
