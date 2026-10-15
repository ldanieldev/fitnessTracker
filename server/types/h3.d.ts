import type { User } from '#auth-utils'

declare module 'h3' {
  interface H3EventContext {
    authVia?: 'session' | 'token'
    accessTokenId?: number
    tokenUser?: User
    sessionUserExists?: boolean
  }
}

export {}
