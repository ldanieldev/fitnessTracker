import { serve } from 'inngest/nuxt'
import { inngest } from '~~/server/utils/inngest/client'
import { importMyMacros } from '~~/server/utils/inngest/functions/importMyMacros'
import { importFitNotes } from '~~/server/utils/inngest/functions/importFitNotes'
import { searchOutboxDrain } from '~~/server/utils/inngest/functions/searchOutboxDrain'
import { searchRebuild } from '~~/server/utils/inngest/functions/searchRebuild'
import { searchNightlyRebuild } from '~~/server/utils/inngest/functions/searchNightlyRebuild'
import { exerciseSearchOutboxDrain } from '~~/server/utils/inngest/functions/exerciseSearchOutboxDrain'
import { exerciseSearchRebuild } from '~~/server/utils/inngest/functions/exerciseSearchRebuild'
import { googleHealthSyncScheduled } from '~~/server/utils/inngest/functions/googleHealthSyncScheduled'
import { googleHealthSyncUser } from '~~/server/utils/inngest/functions/googleHealthSyncUser'
import { googleHealthWeightPush } from '~~/server/utils/inngest/functions/googleHealthWeightPush'
import { rollupNightlyRebuild } from '~~/server/utils/inngest/functions/rollupNightlyRebuild'

export default defineEventHandler(
  serve({
    client: inngest,
    // Otherwise an unsigned PUT re-registers the app at whatever URL its Host header names (cloud mode only).
    enableUnauthedSync: false,
    functions: [
      searchOutboxDrain,
      searchRebuild,
      searchNightlyRebuild,
      exerciseSearchOutboxDrain,
      exerciseSearchRebuild,
      rollupNightlyRebuild,
      importMyMacros,
      importFitNotes,
      googleHealthSyncScheduled,
      googleHealthSyncUser,
      googleHealthWeightPush
    ]
  })
)
