export const OAUTH_ERROR_CODES = [
  'no_email',
  'email_unverified',
  'provider_error',
  'already_linked',
  'account_disabled',
  'registration_closed'
] as const
export type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number]
