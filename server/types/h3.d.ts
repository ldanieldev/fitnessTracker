import type { User } from '#auth-utils'

declare module 'h3' {
  interface H3EventContext {
    authVia?: 'session' | 'token'
    accessTokenId?: number
    tokenUser?: User
    sessionUserValid?: boolean
    sessionIsAdmin?: boolean
  }
}

export {}
