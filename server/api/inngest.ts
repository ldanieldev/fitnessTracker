import { serve } from 'inngest/nuxt'
import { inngest } from '~~/server/utils/inngest/client'
import { importMyMacros } from '~~/server/utils/inngest/functions/importMyMacros'
import { searchOutboxDrain } from '~~/server/utils/inngest/functions/searchOutboxDrain'
import { searchRebuild } from '~~/server/utils/inngest/functions/searchRebuild'
import { searchNightlyRebuild } from '~~/server/utils/inngest/functions/searchNightlyRebuild'

export default defineEventHandler(
  serve({ client: inngest, functions: [searchOutboxDrain, searchRebuild, searchNightlyRebuild, importMyMacros] })
)
