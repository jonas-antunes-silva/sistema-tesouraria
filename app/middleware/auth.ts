// Middleware client-side global — redireciona para /login se não autenticado
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuth()

  // Tenta carregar o usuário se ainda não carregado
  if (auth.user.value === null) {
    await auth.fetchUser()
  }

  // Rota pública — sem redirecionamento
  if (to.path === '/login') {
    if (auth.isAuthenticated.value) {
      return navigateTo('/')
    }
    return
  }

  // Rota protegida — redireciona se não autenticado
  if (!auth.isAuthenticated.value) {
    return navigateTo('/login')
  }
})
