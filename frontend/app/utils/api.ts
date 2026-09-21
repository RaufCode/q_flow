export interface ApiError {
  status: number
  message: string
}

export const TOKEN_COOKIE = 'qflow_token'
export const USER_COOKIE = 'qflow_user'
const FALLBACK_BASE = '/api/v1'

function cookieOpts() {
  return { path: '/', sameSite: 'lax' as const, maxAge: 60 * 60 * 12 }
}

export function resolveApiBase(): string {
  try {
    const config = useRuntimeConfig()
    return ((config.public.apiBase as string) || FALLBACK_BASE).replace(/\/$/, '')
  } catch {
    return FALLBACK_BASE
  }
}

export function getToken(): string | null {
  try {
    return useCookie<string | null>(TOKEN_COOKIE, { ...cookieOpts(), default: () => null }).value ?? null
  } catch {
    return null
  }
}

export function setToken(token: string) {
  try {
    useCookie<string | null>(TOKEN_COOKIE, cookieOpts()).value = token
  } catch {
    // Ignore — cookie persistence unavailable.
  }
}

export function getStoredUser<T = any>(): T | null {
  try {
    return useCookie<T | null>(USER_COOKIE, { ...cookieOpts(), default: () => null }).value ?? null
  } catch {
    return null
  }
}

export function setStoredUser(user: unknown) {
  try {
    useCookie<unknown | null>(USER_COOKIE, cookieOpts()).value = user ?? null
  } catch {
    // Ignore — cookie persistence unavailable.
  }
}

export function clearStoredAuth() {
  try {
    const token = useCookie<string | null>(TOKEN_COOKIE, cookieOpts())
    const user = useCookie<unknown | null>(USER_COOKIE, cookieOpts())
    token.value = null
    user.value = null
  } catch {
    // Ignore — cookies unavailable.
  }
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
