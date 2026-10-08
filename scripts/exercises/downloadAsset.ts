import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

export async function downloadAsset(
  item: { path: string, url: string },
  outDir: string,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  const root = resolve(outDir)
  const outPath = resolve(root, item.path)
  if (!outPath.startsWith(root + sep)) return `${item.path}: resolves outside ${outDir}`
  try {
    const res = await fetchImpl(item.url)
    if (!res.ok) return `${item.path}: ${res.status} ${res.statusText}`
    const body = Buffer.from(await res.arrayBuffer())
    await mkdir(dirname(outPath), { recursive: true })
    // Written aside and renamed so a killed run never leaves a truncated file that the next run would skip.
    await writeFile(`${outPath}.part`, body)
    await rename(`${outPath}.part`, outPath)
    return null
  } catch (err) {
    return `${item.path}: ${err instanceof Error ? err.message : String(err)}`
  }
}
