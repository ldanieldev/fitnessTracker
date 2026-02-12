export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

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
})
