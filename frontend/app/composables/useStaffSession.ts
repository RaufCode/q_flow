import { apiGet, apiPost, apiPatch } from '~/utils/api'
import { isValidResourceId, sanitizeResourceId, sanitizeSearch } from '~/utils/validate'

export interface StaffCounter {
  id: string
  counterNumber: number
  counterName: string
  isActive: boolean
  currentStaffId: string | null
}

export interface StaffTicket {
  id: string
  ticketNumber: string
  customerName: string
  phoneNumber: string
  preferredChannel: string
  status: string
  initialPosition: number
  currentPosition: number
  estimatedWaitTimeMinutes: number
  skipCount: number
  joinedAt: string
  calledAt: string | null
  servicedAt: string | null
  completedAt: string | null
  skippedAt: string | null
  cancelledAt: string | null
  counterId: string | null
  servicedByStaffId: string | null
}

export interface ShiftOverview {
  counter: StaffCounter | null
  activeTicket: StaffTicket | null
  waiting: StaffTicket[]
}

export interface TicketListResult {
  tickets: StaffTicket[]
  pagination: { totalCount: number; page: number; limit: number; totalPages: number }
}

export function useStaffSession() {
  const { user } = useAuth()
  const overview = useState<ShiftOverview | null>('staff-overview', () => null)
  const sessionTickets = useState<StaffTicket[]>('staff-session-tickets', () => [])
  const loading = useState<boolean>('staff-overview-loading', () => false)
  const error = useState<string>('staff-overview-error', () => '')
  const shiftRequired = useState<boolean>('staff-shift-required', () => false)

  const employeeId = computed(() => user.value?.employeeId ?? '')

  // The deployed backend exposes no staff history endpoint, so the history tab
  // is derived from the tickets handled during this session.
  const history = computed(() =>
    sessionTickets.value.filter((t) => t.status !== 'WAITING'),
  )

  /**
   * Strictly validate + sanitize a resource ID before it's interpolated into a
   * URL path. Throws a safe, human-readable error instead of hitting the API
   * with a malformed identifier.
   */
  const requireResourceId = (id: string): string => {
    const clean = sanitizeResourceId(id)
    if (!isValidResourceId(clean)) {
      throw new Error('Invalid ticket ID.')
    }
    return clean
  }

  /**
   * Normalize the varied ticket payloads the backend returns across endpoints
   * (nested `{ ticket }` vs. flat `{ id, ticketNumber, status }`).
   */
  const toTicket = (payload: any): StaffTicket | undefined => {
    if (!payload) return undefined
    if (payload.ticket) return payload.ticket
    if (payload.id && payload.ticketNumber) return payload as StaffTicket
    return undefined
  }

  const trackTicket = (ticket?: StaffTicket | null) => {
    if (!ticket?.id) return
    const next = sessionTickets.value.filter((t) => t.id !== ticket.id)
    next.unshift(ticket)
    sessionTickets.value = next.slice(0, 50)
  }

  /**
   * The deployed backend's `current-ticket` returns an arbitrary CALLED or
   * IN_SERVICE ticket (findFirst with no ordering), so after a staff action the
   * focused ticket (the one they just started/called) is preferred when it is
   * still active; otherwise the endpoint result is used.
   */
  const refresh = async (silent = false, focus?: StaffTicket | null) => {
    if (!silent) loading.value = true
    if (!employeeId.value) {
      shiftRequired.value = true
      overview.value = null
      if (!silent) loading.value = false
      return
    }
    try {
      const [currentRes, queueRes] = await Promise.all([
        apiGet<{ ticket: StaffTicket | null }>(`/staff/counters/${employeeId.value}/current-ticket`),
        apiGet<{ tickets: StaffTicket[] }>(`/staff/counters/${employeeId.value}/queue`),
      ])
      const activeTicket =
        focus && ['CALLED', 'IN_SERVICE'].includes(focus.status)
          ? focus
          : (currentRes.ticket ?? null)
      overview.value = {
        counter: (user.value?.activeCounter as StaffCounter) ?? null,
        activeTicket,
        waiting: queueRes.tickets || [],
      }
      trackTicket(activeTicket)
      error.value = ''
      shiftRequired.value = false
    } catch (err: any) {
      if (/bound to a counter|not currently bound|active counter shift/i.test(err?.message || '')) {
        shiftRequired.value = true
        overview.value = null
      }
      error.value = err?.message || 'Failed to load shift overview.'
    } finally {
      loading.value = false
    }
  }

  const callNext = async () => {
    const res = await apiPost<{ ticket: StaffTicket }>(
      `/staff/counters/${employeeId.value}/call-next`,
    )
    const ticket = toTicket(res)
    trackTicket(ticket)
    await refresh(true, ticket)
    return ticket
  }

  const recallTicket = async (id: string) => {
    const ticketId = requireResourceId(id)
    const res = await apiPost<{ message: string; ticket: StaffTicket }>(
      `/staff/tickets/${ticketId}/recall`,
    )
    const ticket = toTicket(res)
    trackTicket(ticket)
    await refresh(true, ticket)
    return ticket
  }

  const startService = async (id: string) => {
    const ticketId = requireResourceId(id)
    const res = await apiPost<{ message: string; ticket: StaffTicket }>(
      `/staff/tickets/${ticketId}/start`,
    )
    const ticket = toTicket(res)
    trackTicket(ticket)
    await refresh(true, ticket)
    return ticket
  }

  const completeService = async (id: string) => {
    const ticketId = requireResourceId(id)
    const res = await apiPost<{ message: string; ticket: StaffTicket }>(
      `/staff/tickets/${ticketId}/complete`,
    )
    const ticket = toTicket(res)
    trackTicket(ticket)
    await refresh(true, ticket)
    return ticket
  }

  const noShowTicket = async (id: string) => {
    const ticketId = requireResourceId(id)
    const res = await apiPatch<{ message: string; ticket: StaffTicket }>(
      `/staff/tickets/${ticketId}/status`,
      { status: 'NO_SHOW' },
    )
    const ticket = toTicket(res)
    trackTicket(ticket)
    await refresh(true, ticket)
    return ticket
  }

  const skipTicket = async (id: string) => {
    const ticketId = requireResourceId(id)
    const res = await apiPost<{ message: string; ticket: StaffTicket }>(
      `/staff/tickets/${ticketId}/skip`,
    )
    const ticket = toTicket(res)
    trackTicket(ticket)
    await refresh(true, ticket)
    return ticket
  }

  /**
   * Server-side ticket list with the same filters as the admin tickets page.
   * Query params are validated and sanitized before they leave the client.
   */
  const fetchTickets = async (options: {
    status?: string
    search?: string
    page?: number
    limit?: number
  } = {}): Promise<TicketListResult> => {
    const knownStatuses = ['WAITING', 'CALLED', 'IN_SERVICE', 'SERVED', 'SKIPPED', 'CANCELLED', 'AUTO_CANCELLED']
    const status = knownStatuses.includes(options.status || '') ? (options.status as string) : ''
    const search = sanitizeSearch(options.search, 100)
    const page = Math.max(1, Math.min(100000, Math.floor(Number(options.page) || 1)))
    const limit = Math.max(1, Math.min(100, Math.floor(Number(options.limit) || 10)))
    return apiGet<TicketListResult>('/staff/tickets', {
      status,
      search,
      page,
      limit,
    })
  }

  const reset = () => {
    overview.value = null
    sessionTickets.value = []
    error.value = ''
    shiftRequired.value = false
  }

  return {
    overview,
    sessionTickets,
    history,
    loading,
    error,
    shiftRequired,
    trackTicket,
    refresh,
    callNext,
    recallTicket,
    startService,
    completeService,
    noShowTicket,
    skipTicket,
    fetchTickets,
    reset,
  }
}