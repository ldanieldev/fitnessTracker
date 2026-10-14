import { runFitNotesImport } from '../../workouts/fitnotes/run'
import { inngest } from '../client'

export const importFitNotes = inngest.createFunction(
  // retries: 0 because days imported before a failure keep their import keys; a manual re-import skips them.
  { id: 'import-fitnotes', triggers: [{ event: 'import/fitnotes.requested' }], retries: 0 },
  async ({ event }) => runFitNotesImport(event.data.jobId)
)
