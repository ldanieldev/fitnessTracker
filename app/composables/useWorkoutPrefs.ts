import { DEFAULT_PLATE_SIZES } from '~~/shared/utils/plates'

// Sessions signed in before plate sizes existed have no plateSizes until the next login or profile save.
export function useWorkoutPrefs() {
  const { user } = useUserSession()
  return {
    defaultRestSeconds: computed(() => user.value?.defaultRestSeconds ?? 60),
    plateSizes: computed(() => user.value?.plateSizes ?? DEFAULT_PLATE_SIZES)
  }
}
