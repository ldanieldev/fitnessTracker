// Sessions signed in before module toggles existed lack the flags until the next login or profile save; treat as shown.
export function useModules() {
  const { user } = useUserSession()
  return {
    body: computed(() => user.value?.showBody ?? true),
    workouts: computed(() => user.value?.showWorkouts ?? true),
    nutrition: computed(() => user.value?.showNutrition ?? true)
  }
}
