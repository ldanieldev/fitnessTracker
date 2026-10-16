export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()

  // skip middleware for auth pages to avoid redirect loops
  if (to.path.startsWith('/auth')) {
    if (loggedIn.value) {
      return navigateTo('/')
    }
    return
  }

  // redirect the user to the login screen if they're not authenticated
  if (!loggedIn.value) {
    return navigateTo('/auth/login')
  }

  // Strict false: cookies minted before onboarding existed lack the flag and belong to existing, onboarded users.
  const needsOnboarding = user.value?.onboarded === false
  if (needsOnboarding && to.name !== 'welcome') return navigateTo('/welcome')
  if (!needsOnboarding && to.name === 'welcome') return navigateTo('/')
})
