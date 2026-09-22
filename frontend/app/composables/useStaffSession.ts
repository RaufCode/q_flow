import { apiGet, apiPost, apiPatch } from '~/utils/api'

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

  const trackTicket = (ticket?: StaffTicket | null) => {
    if (!ticket?.id) return
    const next = sessionTickets.value.filter((t) => t.id !== ticket.id)
    next.unshift(ticket)
    sessionTickets.value = next.slice(0, 50)
  }

  const refresh = async (silent = false) => {
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
      const activeTicket = currentRes.ticket ?? null
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
    trackTicket(res?.ticket)
    await refresh(true)
    return res?.ticket
  }

  const recallTicket = async (id: string) => {
    const res = await apiPost<{ message: string; ticket: StaffTicket }>(`/staff/tickets/${id}/recall`)
    trackTicket(res?.ticket)
    await refresh(true)
    return res?.ticket
  }

  const completeService = async (id: string) => {
    const res = await apiPatch<{ message: string; ticket: StaffTicket }>(
      `/staff/tickets/${id}/status`,
      { status: 'SERVED' },
    )
    trackTicket(res?.ticket)
    await refresh(true)
    return res?.ticket
  }

  const noShowTicket = async (id: string) => {
    const res = await apiPatch<{ message: string; ticket: StaffTicket }>(
      `/staff/tickets/${id}/status`,
      { status: 'NO_SHOW' },
    )
    trackTicket(res?.ticket)
    await refresh(true)
    return res?.ticket
  }

  const skipTicket = async (id: string) => {
    const res = await apiPost<{ message: string; ticket: StaffTicket }>(
      `/counters/tickets/${id}/skip`,
    )
    trackTicket(res?.ticket)
    await refresh(true)
    return res?.ticket
  }

  /**
   * Server-side ticket list with the same filters as the admin tickets page.
   * Pass the query params straight through — the backend does the work.
   */
  const fetchTickets = async (options: {
    status?: string
    search?: string
    page?: number
    limit?: number
  } = {}): Promise<TicketListResult> => {
    return apiGet<TicketListResult>('/staff/tickets', {
      status: options.status || '',
      search: options.search || '',
      page: options.page || 1,
      limit: options.limit || 10,
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
    completeService,
    noShowTicket,
    skipTicket,
    fetchTickets,
    reset,
  }
}