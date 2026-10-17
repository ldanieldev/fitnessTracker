import { and, eq, getTableColumns } from 'drizzle-orm'
import { users, authProviders } from '~~/server/db/schema'
import { insertUser } from '~~/server/utils/insertUser'
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

  // Check if this provider account is already linked
  const existingLink = await db
    .select({ userId: authProviders.userId })
    .from(authProviders)
    .where(
      and(
        eq(authProviders.provider, providerInfo.provider),
        eq(authProviders.providerAccountId, providerInfo.providerAccountId)
      )
    )
    .limit(1)

  if (existingLink.length) {
    const linkedUserId = existingLink[0]!.userId
    // provider account must not already belong to
    // someone else — refuse rather than hand back a different account.
    if (currentUserId && linkedUserId !== currentUserId) {
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
    await db.insert(authProviders).values({
      userId: currentUserId,
      provider: providerInfo.provider,
      providerAccountId: providerInfo.providerAccountId
    })
    return db
      .select(userColumns)
      .from(users)
      .where(eq(users.id, currentUserId))
      .limit(1)
      .then((r) => r[0]!)
  }

  const email = normalizeEmail(profile.email)
  const link = { provider: providerInfo.provider, providerAccountId: providerInfo.providerAccountId }

  const user = await db
    .select(userColumns)
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .then((r) => r[0])

  if (!user) {
    if (!(await registrationOpen())) throw createError({ statusCode: 403, statusMessage: 'Registration is closed' })
    return db.transaction(async (tx) => {
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
  }

  if (profile.avatarUrl && !user.avatarUrl) {
    await db.update(users).set({ avatarUrl: profile.avatarUrl }).where(eq(users.id, user.id))
    user.avatarUrl = profile.avatarUrl
  }

  await db.insert(authProviders).values({ userId: user.id, ...link })

  return user
}
