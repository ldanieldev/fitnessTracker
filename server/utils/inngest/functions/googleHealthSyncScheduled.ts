import { and, eq } from 'drizzle-orm'
import { googleHealthConnections, users } from '../../../db/schema'
import { db } from '../../db'
import { ACTIVE_USER } from '../../googleHealth/connection'
import { DEFAULT_SYNC_CRON } from '../../googleHealth/scopes'
import { inngest } from '../client'

export const googleHealthSyncScheduled = inngest.createFunction(
  {
    id: 'google-health-sync-scheduled',
    triggers: [{ cron: process.env.NUXT_GOOGLE_HEALTH_SYNC_CRON || DEFAULT_SYNC_CRON }]
  },
  async ({ step }) => {
    const rows = await step.run('list-connections', () =>
      db
        .select({ userId: googleHealthConnections.userId })
        .from(googleHealthConnections)
        .innerJoin(users, and(eq(users.id, googleHealthConnections.userId), ACTIVE_USER))
        .where(eq(googleHealthConnections.status, 'active'))
    )
    if (rows.length) {
      await step.sendEvent(
        'fan-out',
        rows.map((r) => ({ name: 'google-health/sync.requested', data: { userId: r.userId } }))
      )
    }
    return { users: rows.length }
  }
)
