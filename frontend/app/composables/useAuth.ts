import {
  apiPost,
  clearStoredAuth,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
} from '~/utils/api'

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

export function useAuth() {
  const token = useState<string | null>('qflow-auth-token', () => null)
  const user = useState<AuthUser | null>('qflow-auth-user', () => null)

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')
  const isStaff = computed(() => user.value?.role === 'COUNTER_STAFF')

  const hydrate = () => {
    if (import.meta.server) return
    token.value = getToken()
    user.value = getStoredUser<AuthUser>()
  }

  const login = async (employeeId: string, password: string): Promise<LoginResponse> => {
    const res = await apiPost<LoginResponse>('/auth/login', { employeeId, password })
    token.value = res.token
    user.value = res.user
    setToken(res.token)
    setStoredUser(res.user)
    return res
  }

  const setUser = (next: AuthUser | null) => {
    user.value = next
    if (next) setStoredUser(next)
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
    clearStoredAuth()
  }

  return {
    token,
    user,
    isAuthenticated,
    isAdmin,
    isStaff,
    hydrate,
    login,
    setUser,
    logout,
  }
}
