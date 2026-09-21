export interface ApiError {
  status: number
  message: string
}

const TOKEN_KEY = 'qflow_token'
const USER_KEY = 'qflow_user'
const FALLBACK_BASE = '/api/v1'

export function resolveApiBase(): string {
  try {
    const config = useRuntimeConfig()
    return ((config.public.apiBase as string) || FALLBACK_BASE).replace(/\/$/, '')
  } catch {
    return FALLBACK_BASE
  }
}

export function getToken(): string | null {
  if (import.meta.server) return null
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string) {
  if (import.meta.server) return
  localStorage.setItem(TOKEN_KEY, token)
}

export function getStoredUser<T = any>(): T | null {
  if (import.meta.server) return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: unknown) {
  if (import.meta.server) return
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredAuth() {
  if (import.meta.server) return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/**
 * Coerce whatever the API threw into a meaningful, human-readable string.
 * Guards against booleans/objects leaking into the UI (e.g. a raw `true`).
 */
function toMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const msg = toMessage(item)
      if (msg) return msg
    }
    return null
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return toMessage(obj.error) || toMessage(obj.message) || toMessage(obj.detail)
  }
  return null
}

function normalizeError(err: any): ApiError {
  const status: number = err?.response?.status ?? err?.statusCode ?? err?.status ?? 0
  const data = err?.data ?? err?.response?._data
  const message =
    toMessage(data) ||
    toMessage(err?.data) ||
    toMessage(err?.response?._data) ||
    toMessage(err?.statusMessage) ||
    toMessage(err?.message) ||
    'Something went wrong. Please try again.'
  return { status, message }
}

function isSessionError(status: number, message: string): boolean {
  if (status === 401) return true
  if (status === 403 && /token|expired|authorization/i.test(message)) return true
  return false
}

function clearSessionAuth() {
  if (import.meta.server) return
  clearStoredAuth()
  try {
    const token = useState('qflow-auth-token')
    const user = useState('qflow-auth-user')
    if (token && typeof token.value === 'string') token.value = null
    if (user && user.value) user.value = null
  } catch {
    // Nuxt state unavailable — storage was already cleared.
  }
  if (
    typeof window !== 'undefined' &&
    window.location.pathname !== '/' &&
    !window.location.pathname.startsWith('/ticket')
  ) {
    window.location.assign('/')
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export async function apiRequest<T = any>(
  path: string,
  options: { method?: HttpMethod; body?: any; query?: Record<string, any> } = {},
): Promise<T> {
  const base = resolveApiBase().replace(/\/$/, '')
  const token = getToken()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  let url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  if (options.query) {
    const params = new URLSearchParams()
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.append(key, String(value))
    })
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }

  try {
    return await $fetch<T>(url, {
      method: options.method || 'GET',
      headers,
      body: options.body,
    })
  } catch (err) {
    const normalized = normalizeError(err)
    if (token && isSessionError(normalized.status, normalized.message)) {
      clearSessionAuth()
    }
    throw normalized
  }
}

export const apiGet = <T = any>(path: string, query?: Record<string, any>) =>
  apiRequest<T>(path, { method: 'GET', query })

export const apiPost = <T = any>(path: string, body?: any) =>
  apiRequest<T>(path, { method: 'POST', body })

export const apiPatch = <T = any>(path: string, body?: any) =>
  apiRequest<T>(path, { method: 'PATCH', body })
