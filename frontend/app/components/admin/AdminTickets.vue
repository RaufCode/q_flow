<script setup lang="ts">
import { Loader2, Plus, Search, X, Zap } from 'lucide-vue-next'
import { apiGet, apiPost, apiPatch } from '~/utils/api'
import { trim, isValidName, isValidPhone, nameMessage, phoneMessage } from '~/utils/validate'
import { formatTime, statusLabel } from '~/utils/format'

const showToast = inject<(msg: string) => void>('showToast', () => {})

interface AdminTicket {
  id: string
  ticketNumber: string
  customerName: string
  phoneNumber: string
  preferredChannel: string
  status: string
  priority: boolean
  initialPosition: number
  currentPosition: number
  skipCount: number
  joinedAt: string
  calledAt: string | null
  servicedAt: string | null
  completedAt: string | null
  skippedAt: string | null
  cancelledAt: string | null
  counterId: string | null
  servicedByStaffId: string | null
  counter: { counterNumber: number; counterName: string } | null
  servicedByStaff?: { employeeId: string; fullName: string } | null
}

const TICKET_STATUSES = ['WAITING', 'CALLED', 'IN_SERVICE', 'SERVED', 'SKIPPED', 'CANCELLED', 'AUTO_CANCELLED']

const tickets = ref<AdminTicket[]>([])
const totalCount = ref(0)
const totalPages = ref(1)
const page = ref(1)
const statusFilter = ref('')
const search = ref('')
const loading = ref(true)
const errorMsg = ref('')
const refreshing = ref(false)
const applyingId = ref<string | null>(null)

const showPriorityModal = ref(false)
const creating = ref(false)
const priorityForm = ref({ customerName: '', phoneNumber: '', preferredChannel: 'WHATSAPP' })
const priorityErrors = ref({ customerName: '', phoneNumber: '' })
const priorityTouched = ref<Record<string, boolean>>({})

let timer: ReturnType<typeof setInterval> | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null

const isPriorityTicket = (t: AdminTicket) => Boolean(t.priority) || /^VIP-/i.test(t.ticketNumber)

const load = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    const query: Record<string, any> = { page: page.value, limit: 50 }
    if (statusFilter.value) query.status = statusFilter.value
    if (trim(search.value)) query.search = trim(search.value)
    const res = await apiGet<{ tickets: AdminTicket[]; pagination: { totalCount: number; page: number; limit: number; totalPages: number } }>('/admin/tickets', query)
    tickets.value = res.tickets || []
    const pagination = res.pagination || { totalCount: tickets.value.length, page: page.value, limit: 50, totalPages: 1 }
    totalCount.value = pagination.totalCount
    totalPages.value = pagination.totalPages
    page.value = pagination.page
    errorMsg.value = ''
  } catch (err: any) {
    if (!silent) errorMsg.value = err?.message || 'Failed to load tickets.'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const selectStatus = (s: string) => {
  statusFilter.value = s
  page.value = 1
  load()
}

const onSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 300)
}

const applyOverride = async (t: AdminTicket, status: string, event?: Event) => {
  const el = event?.target as HTMLSelectElement | undefined
  if (!status || status === t.status) {
    if (el) el.value = t.status
    return
  }
  applyingId.value = t.id
  try {
    await apiPatch<{ message: string; ticket: AdminTicket }>(`/admin/tickets/${t.id}/override`, { status })
    showToast(`${t.ticketNumber} updated to ${statusLabel(status)}`)
    await load(true)
  } catch (err: any) {
    showToast(err?.message || 'Failed to update ticket status')
    if (el) el.value = t.status
  } finally {
    applyingId.value = null
  }
}

const openPriorityModal = () => {
  priorityForm.value = { customerName: '', phoneNumber: '', preferredChannel: 'WHATSAPP' }
  priorityErrors.value = { customerName: '', phoneNumber: '' }
  priorityTouched.value = {}
  showPriorityModal.value = true
}

const validatePriority = () => {
  const errors = { customerName: '', phoneNumber: '' }
  const name = trim(priorityForm.value.customerName)
  if (!name) errors.customerName = 'Full name is required.'
  else if (!isValidName(name)) errors.customerName = nameMessage(name)
  const phone = trim(priorityForm.value.phoneNumber)
  if (!phone) errors.phoneNumber = 'Phone number is required.'
  else if (!isValidPhone(phone)) errors.phoneNumber = phoneMessage(phone)
  priorityErrors.value = errors
  return !Object.values(errors).some(Boolean)
}

const validatePriorityField = (field: 'customerName' | 'phoneNumber') => {
  priorityTouched.value[field] = true
  validatePriority()
}

const createPriorityTicket = async () => {
  priorityTouched.value = { customerName: true, phoneNumber: true }
  if (!validatePriority()) return
  creating.value = true
  try {
    await apiPost<{ message: string; ticket: AdminTicket }>('/admin/tickets/priority', {
      customerName: trim(priorityForm.value.customerName),
      phoneNumber: trim(priorityForm.value.phoneNumber),
      preferredChannel: priorityForm.value.preferredChannel,
    })
    showToast('Priority ticket issued at position 1')
    showPriorityModal.value = false
    page.value = 1
    statusFilter.value = ''
    await load()
  } catch (err: any) {
    showToast(err?.message || 'Failed to issue priority ticket')
  } finally {
    creating.value = false
  }
}

const lockScroll = (locked: boolean) => {
  if (import.meta.client) document.body.style.overflow = locked ? 'hidden' : ''
}

watch(showPriorityModal, (open) => lockScroll(open))
onUnmounted(() => {
  lockScroll(false)
  if (timer) clearInterval(timer)
  if (searchTimer) clearTimeout(searchTimer)
})

onMounted(() => {
  load()
  timer = setInterval(() => load(true), 10000)
})
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-extrabold tracking-tight text-foreground">Tickets</h2>
        <p class="mt-0.5 text-sm text-muted-foreground">Manage the queue and override ticket states</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-bg-page px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title="Updates automatically every 10 seconds - click to refresh now"
          @click="refreshing = true, load(true)"
        >
          <span class="relative flex h-2 w-2">
            <span
              v-if="!refreshing"
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60"
            />
            <span
              :class="['relative inline-flex h-2 w-2 rounded-full', refreshing ? 'bg-muted-foreground' : 'bg-success']"
            />
          </span>
          {{ refreshing ? 'Refreshing…' : 'Live' }}
        </button>
        <button class="btn btn-sm btn-primary" @click="openPriorityModal">
          <Plus class="h-4 w-4" />
          New Priority Ticket
        </button>
      </div>
    </div>

    <!-- Priority ticket modal -->
    <Teleport to="body">
      <div
        v-if="showPriorityModal"
        class="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-[2px]"
        @click.self="showPriorityModal = false"
      >
        <div class="relative flex min-h-full items-center justify-center p-4 sm:p-6">
          <div class="card relative my-auto w-full max-w-md p-6 text-center shadow-pop">
            <button
              class="absolute right-3 top-3 cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
              @click="showPriorityModal = false"
            >
              <X class="h-4 w-4" />
            </button>
            <span
              class="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary-light text-primary-dark-text"
            >
              <Zap class="h-5 w-5" />
            </span>
            <h3 class="text-base font-bold text-foreground">New Priority Ticket</h3>
            <p class="mt-0.5 text-xs text-muted-foreground">Insert a VIP customer at the front of the queue.</p>

            <div class="mt-6 space-y-4 text-left">
              <div class="space-y-1.5">
                <label class="label" for="priority-name">Customer Name</label>
                <input
                  id="priority-name"
                  v-model="priorityForm.customerName"
                  class="input"
                  :class="priorityTouched.customerName && priorityErrors.customerName ? 'border-danger' : ''"
                  placeholder="e.g. Kwame Asante"
                  autocomplete="off"
                  @blur="validatePriorityField('customerName')"
                  @input="priorityTouched.customerName && validatePriority()"
                />
                <p v-if="priorityTouched.customerName && priorityErrors.customerName" class="text-left text-xs text-danger">{{ priorityErrors.customerName }}</p>
              </div>
              <div class="space-y-1.5">
                <label class="label" for="priority-phone">Phone Number</label>
                <input
                  id="priority-phone"
                  v-model="priorityForm.phoneNumber"
                  class="input"
                  :class="priorityTouched.phoneNumber && priorityErrors.phoneNumber ? 'border-danger' : ''"
                  placeholder="e.g. 0241234567"
                  autocomplete="off"
                  @blur="validatePriorityField('phoneNumber')"
                  @input="priorityTouched.phoneNumber && validatePriority()"
                />
                <p v-if="priorityTouched.phoneNumber && priorityErrors.phoneNumber" class="text-left text-xs text-danger">{{ priorityErrors.phoneNumber }}</p>
              </div>
              <div class="space-y-1.5">
                <label class="label" for="priority-channel">Preferred Channel</label>
                <select id="priority-channel" v-model="priorityForm.preferredChannel" class="input select">
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="SMS">SMS</option>
                  <option value="NONE">None</option>
                </select>
              </div>
            </div>

            <div class="mt-6 flex gap-3">
              <button :disabled="creating" class="btn btn-md btn-primary flex-1" @click="createPriorityTicket">
                <Loader2 v-if="creating" class="h-4 w-4 animate-spin" />
                Issue Priority Ticket
              </button>
              <button class="btn btn-md btn-outline flex-1" @click="showPriorityModal = false">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <p v-if="errorMsg" class="text-xs text-danger">{{ errorMsg }}</p>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex flex-wrap items-center justify-center gap-1">
        <button
          v-for="opt in [{ value: '', label: 'All' }, { value: 'WAITING', label: 'Waiting' }, { value: 'CALLED', label: 'Called' }, { value: 'IN_SERVICE', label: 'In Service' }, { value: 'SERVED', label: 'Served' }, { value: 'SKIPPED', label: 'Skipped' }, { value: 'CANCELLED', label: 'Cancelled' }]"
          :key="opt.value"
          class="inline-flex cursor-pointer items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          :class="statusFilter === opt.value ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-muted text-muted-foreground hover:bg-border'"
          @click="selectStatus(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <div class="relative ml-auto w-full sm:w-64">
        <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="search"
          class="input pl-9"
          placeholder="Search number, name or phone"
          aria-label="Search tickets"
          @input="onSearch"
        />
      </div>
    </div>

    <!-- Table -->
    <div class="card overflow-hidden">
      <div v-if="loading && tickets.length === 0">
        <div class="grid grid-cols-7 items-center gap-4 border-b border-border bg-muted/40 px-5 py-3.5">
          <Skeleton v-for="h in 7" :key="h" class="h-3 w-14" />
        </div>
        <div class="divide-y divide-border">
          <div v-for="r in 6" :key="r" class="grid grid-cols-7 items-center gap-4 px-5 py-3.5">
            <div class="flex items-center gap-2">
              <Skeleton class="h-4 w-12" />
              <Skeleton class="h-4 w-9 rounded-full" />
            </div>
            <div class="space-y-1.5">
              <Skeleton class="h-3.5 w-32" />
              <Skeleton class="h-3 w-24" />
            </div>
            <Skeleton class="h-3.5 w-16" />
            <Skeleton class="h-3.5 w-14" />
            <Skeleton class="h-5 w-20 rounded-full" />
            <Skeleton class="h-3.5 w-12" />
            <div class="justify-self-end">
              <Skeleton class="h-7 w-24 rounded-md" />
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="tickets.length === 0" class="px-5 py-16 text-center text-sm text-muted-foreground">
        No tickets found. Adjust the filters or issue a priority ticket.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="table-gmail w-full text-sm">
          <thead class="bg-muted/40">
            <tr class="border-b border-border">
              <th class="th">Ticket</th>
              <th class="th">Customer</th>
              <th class="th hidden lg:table-cell">Channel</th>
              <th class="th hidden md:table-cell">Served By</th>
              <th class="th">Status</th>
              <th class="th hidden sm:table-cell">Joined</th>
              <th class="th text-right">Override</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="t in tickets" :key="t.id">
              <td class="td">
                <div class="flex items-center gap-2">
                  <span class="font-extrabold tabular-nums text-foreground">{{ t.ticketNumber }}</span>
                  <span
                    v-if="isPriorityTicket(t)"
                    class="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                  >
                    <Zap class="h-3 w-3" />
                    VIP
                  </span>
                </div>
              </td>
              <td class="td">
                <p class="truncate font-semibold text-foreground">{{ t.customerName }}</p>
                <p class="font-mono text-xs text-muted-foreground">{{ t.phoneNumber }}</p>
              </td>
              <td class="td text-muted-foreground hidden lg:table-cell text-xs font-semibold uppercase">
                {{ t.preferredChannel || '—' }}
              </td>
              <td class="td text-muted-foreground hidden md:table-cell text-xs font-mono">
                {{ t.servicedByStaff?.employeeId || '—' }}
              </td>
              <td class="td">
                <StatusPill :status="t.status" />
              </td>
              <td class="td text-xs font-semibold text-muted-foreground hidden sm:table-cell tabular-nums">
                {{ formatTime(t.joinedAt) }}
              </td>
              <td class="td text-right">
                <div class="inline-flex items-center gap-2">
                  <Loader2 v-if="applyingId === t.id" class="h-4 w-4 animate-spin text-muted-foreground" />
                  <select
                    v-else
                    :value="t.status"
                    class="input select w-auto py-1.5 pl-2.5 pr-7 text-xs font-semibold"
                    :aria-label="`Override status for ${t.ticketNumber}`"
                    @change="applyOverride(t, ($event.target as HTMLSelectElement).value, $event)"
                  >
                    <option v-for="s in TICKET_STATUSES" :key="s" :value="s" :disabled="s === t.status">
                      {{ statusLabel(s) }}
                    </option>
                  </select>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalCount > 0" class="flex flex-wrap items-center justify-center gap-3 border-t border-border px-5 py-3">
        <span class="text-xs font-semibold text-muted-foreground tabular-nums">
          {{ (page - 1) * 50 + 1 }}-{{ Math.min(page * 50, totalCount) }} of {{ totalCount }}
        </span>
        <div class="flex items-center gap-1">
          <button
            class="btn btn-xs btn-outline"
            :disabled="page <= 1 || loading"
            @click="page--, load()"
          >
            Prev
          </button>
          <span class="px-2 text-xs font-bold text-muted-foreground tabular-nums">Page {{ page }} / {{ totalPages }}</span>
          <button
            class="btn btn-xs btn-outline"
            :disabled="page >= totalPages || loading"
            @click="page++, load()"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>