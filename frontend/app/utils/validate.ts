export const MAX_EMAIL_LEN = 254
export const MAX_LOCAL_LEN = 64
export const MIN_PASSWORD_LEN = 8
export const MAX_PASSWORD_LEN = 128
export const MIN_NAME_LEN = 2
export const MAX_NAME_LEN = 100
export const MAX_EMPLOYEE_ID_LEN = 20
export const COUNTER_NUMBER_MAX = 999

export function trim(value?: string | null): string {
  return (value ?? '').replace(/^\s+|\s+$/g, '')
}

// ---------------- Email ----------------
// RFC 5322-ish with pragmatic hardening: no consecutive dots, sensible length caps.
const EMAIL_RE =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,63}$/i

export function isValidEmail(value?: string | null): boolean {
  const v = trim(value).toLowerCase()
  if (!v || v.length > MAX_EMAIL_LEN) return false
  if (v.includes('..')) return false
  if (v.startsWith('.') || v.endsWith('.')) return false
  const at = v.indexOf('@')
  if (at <= 0 || at !== v.lastIndexOf('@')) return false
  if (at > MAX_LOCAL_LEN) return false
  return EMAIL_RE.test(v)
}

// ---------------- Phone (Ghana) ----------------
// Mirrors the backend `sanitizePhoneNumber` rules:
//   0XXXXXXXXX (10 digits) | 233XXXXXXXXX (12 digits) | XXXXXXXXX (9 digits).
// Non-digit separators (+, spaces, dashes, dots, parentheses) are allowed.
const PHONE_FRAGMENT_RE = /^\+?[\d\s().-]+$/

export function digitsOf(value?: string | null): string {
  return (value ?? '').replace(/\D/g, '')
}

export function isValidPhone(value?: string | null): boolean {
  const v = trim(value)
  if (!v || v.length > 20) return false
  if (!PHONE_FRAGMENT_RE.test(v)) return false
  const digits = digitsOf(v)
  if (digits.startsWith('233')) return digits.length === 12
  if (digits.startsWith('0')) return digits.length === 10
  return digits.length === 9
}

// ---------------- Name ----------------
// Unicode letters (any language) plus apostrophes, dots, hyphens and single
// spaces. Mirrors the backend rules: 2–100 chars, no repeated punctuation.
const NAME_RE = /^[\p{L}][\p{L}\s.'-]*$/u

export function isValidName(value?: string | null): boolean {
  const v = trim(value)
  if (v.length < MIN_NAME_LEN || v.length > MAX_NAME_LEN) return false
  if (!NAME_RE.test(v)) return false
  if (/\s{2,}/.test(v)) return false
  if (/([.'-])\1/.test(v)) return false
  return true
}

// ---------------- Employee ID ----------------
// Mirrors backend `sanitizeEmployeeId`: 3–20 chars of letters, numbers or
// dashes (underscores not allowed). Lowercase is accepted and uppercased server-side.
const EMPLOYEE_ID_RE = /^[A-Za-z0-9-]+$/

export function isValidEmployeeId(value?: string | null): boolean {
  const v = trim(value)
  if (!v) return false
  return v.length >= 3 && v.length <= MAX_EMPLOYEE_ID_LEN && EMPLOYEE_ID_RE.test(v)
}

// ---------------- Password ----------------
// Mirrors backend `validatePasswordStrength`: 8–128 chars, must include an
// uppercase letter, a lowercase letter and a digit.
export function passwordIssues(value?: string | null): string[] {
  const v = value ?? ''
  const issues: string[] = []
  if (!trim(v)) {
    issues.push('Password is required.')
    return issues
  }
  if (v.length < MIN_PASSWORD_LEN) issues.push(`Use at least ${MIN_PASSWORD_LEN} characters.`)
  if (v.length > MAX_PASSWORD_LEN) issues.push(`Keep it under ${MAX_PASSWORD_LEN} characters.`)
  if (!/[A-Z]/.test(v)) issues.push('Include at least one uppercase letter.')
  if (!/[a-z]/.test(v)) issues.push('Include at least one lowercase letter.')
  if (!/\d/.test(v)) issues.push('Include at least one number.')
  if (/\s/.test(v)) issues.push('Remove spaces.')
  return issues
}

export function isValidPassword(value?: string | null): boolean {
  return passwordIssues(value ?? '').length === 0
}

// ---------------- Counter ----------------
// Mirrors backend `sanitizeCounterName`: 1–100 chars after trimming and
// collapsing runs of whitespace to single spaces.
export function isValidCounterName(value?: string | null): boolean {
  const v = trim(value).replace(/\s+/g, ' ')
  return v.length >= 1 && v.length <= 100
}

export function isValidCounterNumber(value?: string | number | null): boolean {
  if (value === null || value === undefined || value === '') return false
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= COUNTER_NUMBER_MAX
}

// ---------------- URL ----------------
// Absolute http(s) link with a real host, no spaces, no credentials.
export function isValidUrl(value?: string | null): boolean {
  const v = trim(value)
  if (!v || v.length > 2048) return false
  if (/\s/.test(v)) return false
  if (!/^https?:\/\//i.test(v)) return false
  try {
    const u = new URL(v)
    if (u.username || u.password) return false
    if (!u.hostname) return false
    if (u.hostname.includes(' ')) return false
    return true
  } catch {
    return false
  }
}

// ---------------- Field messages ----------------
// Human-friendly, precise messages used across forms.
export function emailMessage(value?: string | null): string {
  const v = trim(value)
  if (!v) return 'Email is required.'
  if (v.length > MAX_EMAIL_LEN) return 'Email is too long (max 254 characters).'
  if (!v.includes('@')) return 'Email must include an "@" symbol.'
  if (v.includes('..') || v.startsWith('.') || v.endsWith('.')) return 'Email contains invalid dots.'
  return 'Enter a valid email address (e.g. name@company.com).'
}

export function phoneMessage(value?: string | null): string {
  const v = trim(value)
  if (!v) return 'Phone number is required.'
  if (!PHONE_FRAGMENT_RE.test(v)) return 'Phone can only contain digits and +, spaces, dashes, dots or parentheses.'
  if (isValidPhone(v)) return ''
  return 'Enter a valid Ghana number, e.g. 0241234567 or +233241234567.'
}

export function nameMessage(value?: string | null): string {
  const v = trim(value)
  if (!v) return 'Full name is required.'
  if (v.length < MIN_NAME_LEN) return `Name must be at least ${MIN_NAME_LEN} characters.`
  if (v.length > MAX_NAME_LEN) return `Name must be under ${MAX_NAME_LEN} characters.`
  if (/\s{2,}/.test(v)) return 'Remove extra spaces between names.'
  if (/([.'-])\1/.test(v)) return 'Remove repeated punctuation from the name.'
  return 'Name can only contain letters, spaces, dots, hyphens and apostrophes.'
}

export function employeeIdMessage(value?: string | null): string {
  const v = trim(value)
  if (!v) return 'Employee ID is required.'
  if (v.length < 3) return 'Employee ID must be at least 3 characters.'
  if (v.length > MAX_EMPLOYEE_ID_LEN) return `Employee ID must be under ${MAX_EMPLOYEE_ID_LEN} characters.`
  if (!EMPLOYEE_ID_RE.test(v)) return 'Employee ID can only contain letters, numbers and dashes.'
  return ''
}