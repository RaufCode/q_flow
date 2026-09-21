import { apiPost, TOKEN_COOKIE, USER_COOKIE } from '~/utils/api'

export interface AuthCounter {
  id: string
  counterNumber: number
  counterName: string
  isActive?: boolean
  currentStaffId?: string | null
}

export interface AuthUser {
  id: string
  employeeId: string
  fullName: string
  role: 'ADMIN' | 'COUNTER_STAFF'
  activeCounter?: AuthCounter | null
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

const COOKIE_OPTS = { path: '/', sameSite: 'lax' as const, maxAge: 60 * 60 * 12 }

export function useAuth() {
  const token = useCookie<string | null>(`${TOKEN_COOKIE}`, { ...COOKIE_OPTS, default: () => null })
  const user = useCookie<AuthUser | null>(`${USER_COOKIE}`, { ...COOKIE_OPTS, default: () => null })

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')
  const isStaff = computed(() => user.value?.role === 'COUNTER_STAFF')

  const login = async (employeeId: string, password: string): Promise<LoginResponse> => {
    const res = await apiPost<LoginResponse>('/auth/login', { employeeId, password })
    token.value = res.token
    user.value = res.user
    return res
  }

  const setUser = (next: AuthUser | null) => {
    user.value = next
  }

  const logout = async (options: { unbind?: boolean } = {}) => {
    if (options.unbind !== false && token.value) {
      try {
        await apiPost('/auth/unbind-shift')
      } catch {
        // Ignore — the local session is cleared regardless.
      }
    }
    token.value = null
    user.value = null
  }

  return {
    token,
    user,
    isAuthenticated,
    isAdmin,
    isStaff,
    login,
    setUser,
    logout,
  }
}