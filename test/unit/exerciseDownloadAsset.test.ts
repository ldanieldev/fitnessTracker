import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadAsset } from '../../scripts/exercises/downloadAsset'

const okFetch = (body: string) => vi.fn(async () => new Response(body, { status: 200 })) as unknown as typeof fetch

const dirs: string[] = []
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'assets-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('downloadAsset', () => {
  it('writes the file under its folder and leaves no partial file behind', async () => {
    const dir = tempDir()
    expect(await downloadAsset({ path: 'Air_Bike/0.jpg', url: 'https://x/0.jpg' }, dir, okFetch('jpeg'))).toBeNull()
    expect(readFileSync(join(dir, 'Air_Bike/0.jpg'), 'utf8')).toBe('jpeg')
    expect(readdirSync(join(dir, 'Air_Bike'))).toEqual(['0.jpg'])
  })

  it('reports an HTTP failure without writing anything', async () => {
    const dir = tempDir()
    const notFound = vi.fn(async () => new Response('', { status: 404, statusText: 'Not Found' }))
    expect(await downloadAsset({ path: 'A/0.jpg', url: 'https://x' }, dir, notFound as unknown as typeof fetch)).toBe(
      'A/0.jpg: 404 Not Found'
    )
    expect(existsSync(join(dir, 'A'))).toBe(false)
  })

  it('reports a write failure instead of throwing', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'A'), 'a file where the folder should be')
    expect(await downloadAsset({ path: 'A/0.jpg', url: 'https://x' }, dir, okFetch('jpeg'))).toMatch(/^A\/0\.jpg: /)
  })

  it('refuses a path that escapes the output folder without fetching it', async () => {
    const dir = tempDir()
    const fetchImpl = okFetch('x')
    expect(await downloadAsset({ path: '../evil.jpg', url: 'https://x' }, dir, fetchImpl)).toMatch(/outside/)
    expect(await downloadAsset({ path: '/etc/evil.jpg', url: 'https://x' }, dir, fetchImpl)).toMatch(/outside/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
