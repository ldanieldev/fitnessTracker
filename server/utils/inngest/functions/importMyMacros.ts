import { db } from '../../db'
import { runMyMacrosImport } from '../../nutrition/mymacros/run'
import { inngest } from '../client'

export const importMyMacros = inngest.createFunction(
  // retries: 0 — the import is not safe to retry after a partial failure; a retry would double-count foodsCreated in the stored result.
  { id: 'import-mymacros', triggers: [{ event: 'import/mymacros.requested' }], retries: 0 },
  async ({ event }) => runMyMacrosImport(db, event.data.jobId)
)
