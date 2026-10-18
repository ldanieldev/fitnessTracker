import { and, eq, getTableColumns } from 'drizzle-orm'
import type { H3Error } from 'h3'
import { users, authProviders } from '~~/server/db/schema'
import { insertUser } from '~~/server/utils/insertUser'
import { logger } from '~~/server/utils/logger'
import { normalizeEmail } from '~~/shared/utils/email'
import { assertRegistrationOpenIn, registrationOpen } from '~~/server/utils/registration'

interface OAuthProfile {
  email: string
  name: string
  avatarUrl?: string
}

interface ProviderInfo {
  provider: string
  providerAccountId: string
}

export async function findOrCreateUserAndLinkProvider(
  profile: OAuthProfile,
  providerInfo: ProviderInfo,
  currentUserId?: number
) {
  const { password, ...userColumns } = getTableColumns(users)
  const { provider, providerAccountId } = providerInfo

  // Check if this provider account is already linked
  const existingLink = await db
    .select({ userId: authProviders.userId })
    .from(authProviders)
    .where(and(eq(authProviders.provider, provider), eq(authProviders.providerAccountId, providerAccountId)))
    .limit(1)

  if (existingLink.length) {
    const linkedUserId = existingLink[0]!.userId
    // provider account must not already belong to
    // someone else — refuse rather than hand back a different account.
    if (currentUserId && linkedUserId !== currentUserId) {
      logger.warn(
        { event: 'auth.oauth_link_conflict', provider, providerAccountId, linkedUserId, currentUserId },
        'OAuth account already linked to another user'
      )
      throw createError({
        statusCode: 409,
        statusMessage: 'This account is already linked to a different user.'
      })
    }
    // Provider already linked — return the user
    const result = await db.select(userColumns).from(users).where(eq(users.id, linkedUserId)).limit(1)
    return result[0]!
  }

  // Linking while signed in: attach the provider to the CURRENT user and never
  // resolve by email — doing so would switch the session to whoever owns that
  // email (or create a new user) if it differs from the signed-in account.
  if (currentUserId) {
    await db.insert(authProviders).values({ userId: currentUserId, provider, providerAccountId })
    logger.info({ event: 'auth.oauth_linked', userId: currentUserId, provider }, 'OAuth provider linked')
    return db
      .select(userColumns)
      .from(users)
      .where(eq(users.id, currentUserId))
      .limit(1)
      .then((r) => r[0]!)
  }

  const email = normalizeEmail(profile.email)
  const link = { provider, providerAccountId }

  const user = await db
    .select(userColumns)
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .then((r) => r[0])

  if (!user) {
    if (!(await registrationOpen())) {
      logger.info({ event: 'auth.register_closed', method: provider }, 'registration refused: closed')
      throw createError({ statusCode: 403, statusMessage: 'Registration is closed' })
    }
    const created = await db.transaction(async (tx) => {
      await assertRegistrationOpenIn(tx)
      const created = await insertUser(tx, {
        email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        age: 0,
        isActive: true
      })
      await tx.insert(authProviders).values({ userId: created.id, ...link })
      return created
    })
    logger.info(
      { event: 'auth.register', userId: created.id, method: provider, isAdmin: created.isAdmin },
      'user registered'
    )
    return created
  }

  if (profile.avatarUrl && !user.avatarUrl) {
    await db.update(users).set({ avatarUrl: profile.avatarUrl }).where(eq(users.id, user.id))
    user.avatarUrl = profile.avatarUrl
  }

  await db.insert(authProviders).values({ userId: user.id, ...link })
  logger.info({ event: 'auth.oauth_autolink', userId: user.id, provider }, 'OAuth provider linked by verified email')

  return user
}

// pino serialises h3's `data`, the provider's query or token response (code, state, access_token): copy without it.
export function withoutErrorData(error: unknown): unknown {
  if (!(error instanceof Error) || !('data' in error)) return error
  return Object.assign(new Error(error.message, { cause: error.cause }), {
    name: error.name,
    stack: error.stack,
    statusCode: (error as Partial<H3Error>).statusCode
  })
}

const DECLINED_OAUTH_ERRORS = new Set(['access_denied'])

export function logOAuthFlowError(provider: string, error: H3Error) {
  const data = error.data as { error?: unknown } | undefined
  const providerError = typeof data?.error === 'string' ? data.error : undefined
  if (providerError && DECLINED_OAUTH_ERRORS.has(providerError)) {
    logger.info({ event: 'auth.oauth_declined', provider, providerError }, 'OAuth sign-in declined at the provider')
    return
  }
  logger.error(
    { err: withoutErrorData(error), route: `/api/auth/${provider}`, provider, providerError },
    'OAuth flow failed'
  )
}
