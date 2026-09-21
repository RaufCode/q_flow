import type { AuthUser } from '~/composables/useAuth'
import { getStoredUser, getToken } from '~/utils/api'

export default defineNuxtPlugin(() => {
  const token = useState<string | null>('qflow-auth-token')
  const user = useState<AuthUser | null>('qflow-auth-user')

  token.value = getToken()
  user.value = getStoredUser<AuthUser>()
})
