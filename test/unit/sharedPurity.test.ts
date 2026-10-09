import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : []
  })
}

describe('shared/', () => {
  it('imports nothing from the server-only h3 package', () => {
    const offenders = sourceFiles('shared').filter((file) => /from ['"]h3['"]/.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
