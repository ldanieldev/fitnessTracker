declare module '#auth-utils' {
  interface User {
    id: number
    email: string
    name: string
    avatar_url: string | null
    age: number
    sex: string | null
  }
}

export {}
