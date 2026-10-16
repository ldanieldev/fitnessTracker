declare module '#auth-utils' {
  interface User {
    id: number
    email: string
    name: string
    avatar_url: string | null
    age: number
    sex: string | null
    weekStart: 0 | 1
    defaultRestSeconds: number
    plateSizes: number[]
    oneRepMaxRepCap: number
    workoutsPerWeek: number
    showBody: boolean
    showWorkouts: boolean
    showNutrition: boolean
    isAdmin: boolean
    onboarded?: boolean
  }

  interface SecureSessionData {
    epoch: number
  }
}

export {}
