import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PINNED_COMMIT = '170cfacda79376dd59ac0cf2f7dfab8ff9f4443a'
const BASE_URL = `https://raw.githubusercontent.com/Jsplice/MuscleMap/${PINNED_COMMIT}/packages/assets/src`
const OUT_PATH = 'app/assets/bodyMap.json'

interface OutlinePath {
  id: string
  side: string
  d: string
}

interface MusclePath {
  group: string
  side: string
  id: string
  d: string
}

interface BodyDiagram {
  viewBox: string
  centerX: number
  outline: OutlinePath[]
  muscles: MusclePath[]
}

interface Diagram {
  viewBox: string
  centerX: number
  outline: string[]
  muscles: { id: string, group: string, side: string, d: string }[]
}

function toDiagram(source: BodyDiagram): Diagram {
  return {
    viewBox: source.viewBox,
    centerX: source.centerX,
    outline: source.outline.map((path) => path.d),
    muscles: source.muscles.map(({ id, group, side, d }) => ({ id, group, side, d }))
  }
}

// Bun transpiles TS on import; downloading to a scratch dir avoids regex-stripping the upstream source.
const scratchDir = mkdtempSync(join(tmpdir(), 'musclemap-'))
try {
  const files = ['male-front.ts', 'male-back.ts']
  for (const file of files) {
    const response = await fetch(`${BASE_URL}/${file}`)
    if (!response.ok) throw new Error(`fetch failed for ${file}: ${response.status} ${response.statusText}`)
    writeFileSync(join(scratchDir, file), await response.text())
  }

  const front = (await import(join(scratchDir, 'male-front.ts'))).MALE_FRONT as BodyDiagram
  const back = (await import(join(scratchDir, 'male-back.ts'))).MALE_BACK as BodyDiagram

  const output = {
    _license: 'MuscleMap (MIT), commit 170cfacd',
    front: toDiagram(front),
    back: toDiagram(back)
  }

  writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`)
  const counts = `front ${output.front.muscles.length} muscles, back ${output.back.muscles.length} muscles`
  console.log(`wrote ${OUT_PATH}: ${counts}`)
} finally {
  rmSync(scratchDir, { recursive: true, force: true })
}
