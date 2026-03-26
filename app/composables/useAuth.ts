import type { Ref, ComputedRef } from 'vue'

interface AuthUser {
  id: string
  nome: string
  email: string
  grupos: string[]
}

interface UseAuth {
  user: Ref<AuthUser | null>
  isAuthenticated: ComputedRef<boolean>
  fetchUser(): Promise<void>
  login(email: string, senha: string): Promise<void>
  logout(): Promise<void>
  hasPermission(permissao: string): boolean
}

export const useAuth = (): UseAuth => {
  const user = useState<AuthUser | null>('auth:user', () => null)
  const isAuthenticated = computed(() => user.value !== null)

  const fetchUser = async () => {
    try {
      const data = await $fetch<AuthUser>('/api/auth/me')
      user.value = data
    } catch {
      user.value = null
    }
  }

  const login = async (email: string, senha: string): Promise<void> => {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email, senha },
    })
    await fetchUser()
  }

  const logout = async (): Promise<void> => {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    await navigateTo('/login')
  }

  const hasPermission = (permissao: string): boolean => {
    if (!user.value) return false
    return user.value.grupos.includes(permissao) || user.value.grupos.includes('admin')
  }

  return { user, isAuthenticated, fetchUser, login, logout, hasPermission }
}
