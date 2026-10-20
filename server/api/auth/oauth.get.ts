import { configuredOAuthProviders } from '~~/shared/utils/oauthProviders'

export default defineEventHandler(() => ({ providers: configuredOAuthProviders(useRuntimeConfig().oauth) }))
