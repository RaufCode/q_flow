export type BackendTicketStatus =
  | 'WAITING'
  | 'CALLED'
  | 'IN_SERVICE'
  | 'SERVED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'AUTO_CANCELLED'

export type BackendChannel = 'WHATSAPP' | 'SMS' | 'NONE'

export const STATUS_LABELS: Record<string, string> = {
  WAITING: 'Waiting',
  CALLED: 'Called',
  IN_SERVICE: 'In Service',
  SERVED: 'Served',
  SKIPPED: 'Skipped',
  CANCELLED: 'Cancelled',
  AUTO_CANCELLED: 'Auto Cancelled',
}

export const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'CALLED', label: 'Called' },
  { value: 'IN_SERVICE', label: 'In Service' },
  { value: 'SERVED', label: 'Served' },
  { value: 'SKIPPED', label: 'Skipped' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'AUTO_CANCELLED', label: 'Auto Cancelled' },
]

export function statusLabel(status?: string | null): string {
  if (!status) return 'N/A'
  return STATUS_LABELS[status] || status
}

export const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  NONE: 'None',
}

export function channelLabel(channel?: string | null): string {
  if (!channel) return 'N/A'
  return CHANNEL_LABELS[channel] || channel
}

export function formatTime(value?: string | Date | null): string {
  if (!value) return 'N/A'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return 'N/A'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return 'N/A'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
}

export function roleLabel(role?: string | null): string {
  if (role === 'ADMIN') return 'Admin'
  if (role === 'COUNTER_STAFF') return 'Counter Staff'
  return role || 'N/A'
}
