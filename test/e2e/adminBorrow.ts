import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clearAdmin, currentAdminId, findUserIdByEmail, transferAdmin } from '../../server/utils/admin/accounts'
import { withAdminDb } from './adminDb'

// Outlives a killed run (and a reboot) so globalTeardown can hand the flag back; the first borrow's record wins.
export const BORROW_RECORD = fileURLToPath(
  new URL('../../node_modules/.cache/mfj-e2e-admin-borrow.json', import.meta.url)
)

async function readRecord(record: string): Promise<{ previousAdminId: number | null } | null> {
  try {
    return JSON.parse(await readFile(record, 'utf8'))
  } catch {
    return null
  }
}

export async function borrowAdmin(email: string, record = BORROW_RECORD) {
  await withAdminDb(async (client) => {
    const id = await findUserIdByEmail(client, email)
    if (id === null) throw new Error(`borrowAdmin: no user ${email}`)
    if (!(await readRecord(record))) {
      await mkdir(dirname(record), { recursive: true })
      await writeFile(record, JSON.stringify({ previousAdminId: await currentAdminId(client) }))
    }
    await transferAdmin(client, id, { bumpEpochs: false })
  })
}

export async function restoreAdmin(record = BORROW_RECORD) {
  const saved = await readRecord(record)
  if (!saved) return
  await withAdminDb(async (client) => {
    if (saved.previousAdminId === null) await clearAdmin(client)
    else await transferAdmin(client, saved.previousAdminId, { bumpEpochs: false })
  })
  await rm(record)
}
