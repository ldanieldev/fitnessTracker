import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { assetPlan } from '../../shared/utils/exerciseAssets'

const PINNED_COMMIT = 'a859101d633a01c4a1a920d6a8ce41dabba0705f'
const SOURCE_URL = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${PINNED_COMMIT}/dist/exercises.json`
const OUT_DIR = 'public/exercises'
const CONCURRENCY = 8

interface SeedEntry {
  images: string[]
}

function walkExisting(dir: string, base = dir): Set<string> {
  const found = new Set<string>()
  if (!existsSync(dir)) return found
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) for (const path of walkExisting(full, base)) found.add(path)
    else found.add(full.slice(base.length + 1))
  }
  return found
}

const response = await fetch(SOURCE_URL)
if (!response.ok) throw new Error(`fetch failed: ${response.status} ${response.statusText}`)
const entries = (await response.json()) as SeedEntry[]
const images = entries.flatMap((entry) => entry.images)
const distinctCount = new Set(images).size

const existing = walkExisting(OUT_DIR)
const plan = assetPlan(images, existing)

const failures: string[] = []
let fetched = 0

async function downloadOne({ path, url }: { path: string, url: string }) {
  const res = await fetch(url)
  if (!res.ok) {
    failures.push(`${path}: ${res.status} ${res.statusText}`)
    return
  }
  const outPath = join(OUT_DIR, path)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, Buffer.from(await res.arrayBuffer()))
  fetched++
}

async function runPool(items: typeof plan, concurrency: number) {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      let item = queue.shift()
      while (item) {
        await downloadOne(item)
        item = queue.shift()
      }
    })
  )
}

await runPool(plan, CONCURRENCY)

console.log(`fetched ${fetched}, skipped ${distinctCount - plan.length}`)

if (failures.length > 0) {
  console.error(`${failures.length} download(s) failed:`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}
