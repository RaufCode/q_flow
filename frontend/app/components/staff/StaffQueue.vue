<script setup lang="ts">
import {
  Loader2,
  UserCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  Bell,
  CheckCircle2,
  SkipForward,
  Play,
} from 'lucide-vue-next'
import { formatTime, channelLabel, statusLabel } from '~/utils/format'

const emit = defineEmits<{ selectTicket: [id: string] }>()

const {
  overview,
  fetchTickets,
  callNext,
  startService,
  completeService,
  skipTicket,
  recallTicket,
  noShowTicket,
  trackTicket,
  error,
} = useStaffSession()
const showToast = inject<(msg: string) => void>('showToast', () => {})
const search = ref('')
const filter = ref('')
const page = ref(1)
const PER = 10
const tickets = ref<any[]>([])
const loading = ref(false)
const acting = ref<string | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const QUEUE_STATUSES = ['WAITING', 'CALLED']
const STATUS_PILLS = [
  { value: '', label: 'All' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'CALLED', label: 'Called' },
]

const activeTicket = computed(() => overview.value?.activeTicket ?? null)
const waitingCount = computed(() => overview.value?.waiting?.length ?? 0)

const rows = computed(() =>
  [...tickets.value]
    .filter((t) => QUEUE_STATUSES.includes(t.status))
    .sort((a, b) => (a.currentPosition || 9999) - (b.currentPosition || 9999)),
)

const totalPages = computed(() => Math.max(1, Math.ceil(rows.value.length / PER)))
const paginated = computed(() => rows.value.slice((page.value - 1) * PER, page.value * PER))

const loadQueue = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    const statuses = filter.value ? [filter.value] : QUEUE_STATUSES
    const results = await Promise.all(
      statuses.map((status) =>
        fetchTickets({
          status,
          search: search.value.trim(),
          page: 1,
          limit: 100,
        }),
      ),
    )
    const seen = new Set<string>()
    tickets.value = results
      .flatMap((res) => res.tickets ?? [])
      .filter((t) => {
        if (seen.has(t.id)) return false
        seen.add(t.id)
        return true
      })
    page.value = 1
  } catch (err: any) {
    showToast(err?.message || 'Failed to load queue', 'error')
  } finally {
    loading.value = false
  }
}

watch([search, filter], () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadQueue(), 300)
})

onMounted(() => loadQueue())
onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

const afterAction = async (message: string) => {
  showToast(message, 'success')
  await Promise.all([loadQueue(true)])
}

const ticketLabel = (t: any) => (t?.customerName ? ` — ${t.customerName}` : '')

const handleCallNext = async () => {
  acting.value = 'call-next'
  try {
    const lingering = activeTicket.value && activeTicket.value.status === 'CALLED' ? activeTicket.value : null
    if (lingering) {
      await noShowTicket(lingering.id)
      showToast(`${lingering.ticketNumber} never arrived — cancelled. Calling next.`, 'info')
    }
    const ticket = await callNext()
    if (ticket) {
      await afterAction(`Calling ${ticket.ticketNumber}${ticketLabel(ticket)}`)
    }
  } catch (err: any) {
    showToast(err?.message || 'Failed to call next customer', 'error')
  } finally {
    acting.value = null
  }
}

const handleStart = async () => {
  if (!activeTicket.value) return
  acting.value = 'start'
  try {
    const t = await startService(activeTicket.value.id)
    await afterAction(`${t.ticketNumber} — service started`)
  } catch (err: any) {
    showToast(err?.message || 'Failed to start service', 'error')
  } finally {
    acting.value = null
  }
}

const handleServe = async () => {
  if (!activeTicket.value) return
  acting.value = 'serve'
  try {
    const t = await completeService(activeTicket.value.id)
    await afterAction(`${t.ticketNumber}${ticketLabel(t)} completed`)
  } catch (err: any) {
    showToast(err?.message || 'Failed to complete ticket', 'error')
  } finally {
    acting.value = null
  }
}

const handleSkip = async () => {
  if (!activeTicket.value) return
  acting.value = 'skip'
  try {
    const t = await skipTicket(activeTicket.value.id)
    await afterAction(`${t.ticketNumber} skipped to back of queue`)
  } catch (err: any) {
    showToast(err?.message || 'Failed to skip ticket', 'error')
  } finally {
    acting.value = null
  }
}

const handleRecall = async () => {
  if (!activeTicket.value) return
  acting.value = 'recall'
  try {
    const t = await recallTicket(activeTicket.value.id)
    await afterAction(`${(t?.ticketNumber || activeTicket.value.ticketNumber)} re-notified`)
  } catch (err: any) {
    showToast(err?.message || 'Failed to re-notify', 'error')
  } finally {
    acting.value = null
  }
}

const handleSelect = (t: any) => {
  trackTicket(t)
  emit('selectTicket', t.id)
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-xl font-extrabold tracking-tight text-foreground">Queue</h2>
        <p class="mt-0.5 text-sm text-muted-foreground">
          <span class="font-bold text-foreground tabular-nums">{{ waitingCount }}</span>
          {{ waitingCount === 1 ? 'customer' : 'customers' }} waiting
        </p>
      </div>

      <!-- Active ticket quick actions -->
      <div v-if="activeTicket" class="flex flex-wrap items-center gap-2">
        <span class="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
          <span class="h-1.5 w-1.5 rounded-full bg-primary" />
          {{ activeTicket.ticketNumber }} · {{ activeTicket.customerName }}
          <span class="text-muted-foreground">({{ statusLabel(activeTicket.status) }})</span>
          <span v-if="activeTicket.skipCount > 0" class="text-muted-foreground">· skipped {{ activeTicket.skipCount }}/3</span>
        </span>
        <button
          v-if="activeTicket.status === 'CALLED'"
          :disabled="acting !== null"
          class="btn btn-sm btn-primary"
          @click="handleStart"
        >
          <Loader2 v-if="acting === 'start'" class="h-3.5 w-3.5 animate-spin" />
          <Play v-else class="h-3.5 w-3.5" />
          Start
        </button>
        <button
          v-if="activeTicket.status === 'IN_SERVICE'"
          :disabled="acting !== null"
          class="btn btn-sm btn-success"
          @click="handleServe"
        >
          <Loader2 v-if="acting === 'serve'" class="h-3.5 w-3.5 animate-spin" />
          <CheckCircle2 v-else class="h-3.5 w-3.5" />
          Complete
        </button>
        <button
          v-if="activeTicket.status === 'CALLED'"
          :disabled="acting !== null"
          class="btn btn-sm btn-outline"
          @click="handleRecall"
        >
          <Loader2 v-if="acting === 'recall'" class="h-3.5 w-3.5 animate-spin" />
          <Bell v-else class="h-3.5 w-3.5" />
          Recall
        </button>
        <button
          v-if="activeTicket.status === 'CALLED'"
          :disabled="acting !== null"
          class="btn btn-sm btn-ghost-danger"
          @click="handleSkip"
        >
          <Loader2 v-if="acting === 'skip'" class="h-3.5 w-3.5 animate-spin" />
          <SkipForward v-else class="h-3.5 w-3.5" />
          Skip
        </button>
      </div>

      <!-- Call next (customer name & number live in the queue list on the side) -->
      <div class="flex flex-col items-end gap-1.5">
        <button
          :disabled="acting !== null || waitingCount === 0 || activeTicket?.status === 'IN_SERVICE'"
          class="btn btn-primary !rounded-lg !px-4 !py-2.5 gap-2"
          @click="handleCallNext"
        >
          <Loader2 v-if="acting === 'call-next'" class="h-4 w-4 animate-spin" />
          <UserCheck v-else class="h-4 w-4" />
          <span>{{ acting === 'call-next' ? 'Calling…' : 'Call Next' }}</span>
        </button>
        <p
          v-if="activeTicket?.status === 'IN_SERVICE' || waitingCount === 0"
          class="text-[11px] font-semibold text-muted-foreground"
        >
          {{ activeTicket?.status === 'IN_SERVICE' ? 'Finish the current service first' : 'No customers waiting' }}
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row">
      <div class="flex flex-wrap items-center gap-1">
        <button
          v-for="opt in STATUS_PILLS"
          :key="opt.value"
          class="inline-flex cursor-pointer items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          :class="filter === opt.value ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-muted text-muted-foreground hover:bg-border'"
          @click="filter = opt.value; page = 1"
        >
          {{ opt.label }}
        </button>
      </div>
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="search"
          class="input pl-9"
          placeholder="Search by name or ticket number…"
        />
      </div>
    </div>

    <p v-if="error" class="text-xs text-danger">{{ error }}</p>

    <div class="card overflow-hidden">
      <SkeletonTable v-if="loading && tickets.length === 0" :rows="7" :cols="5" />
      <div v-else class="overflow-x-auto">
        <table class="table-gmail w-full text-sm">
          <thead class="bg-muted/40">
            <tr class="border-b border-border">
              <th class="th">Position</th>
              <th class="th">Ticket</th>
              <th class="th">Customer</th>
              <th class="th hidden sm:table-cell">Channel</th>
              <th class="th hidden md:table-cell">Status</th>
              <th class="th hidden md:table-cell">Joined</th>
              <th class="th text-right"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="paginated.length === 0">
              <td colspan="7" class="px-5 py-14 text-center text-muted-foreground">
                <p class="text-sm font-semibold">
                  {{ waitingCount > 0 ? 'No tickets match your filters.' : 'No customers in queue right now.' }}
                </p>
                <p class="mt-1 text-xs">
                  {{ waitingCount > 0 ? 'Try clearing the search or status filter.' : 'Share the check-in QR code so customers can join.' }}
                </p>
              </td>
            </tr>
            <tr
              v-for="t in paginated"
              :key="t.id"
              class="cursor-pointer"
              @click="handleSelect(t)"
            >
              <td class="td font-extrabold text-foreground tabular-nums">
                {{ t.currentPosition > 0 ? t.currentPosition : '0' }}
              </td>
              <td class="td font-extrabold text-gray-900 tabular-nums">{{ t.ticketNumber }}</td>
              <td class="td">
                <p class="truncate font-semibold text-foreground">{{ t.customerName }}</p>
                <p class="text-xs text-muted-foreground">{{ t.phoneNumber }}</p>
              </td>
              <td class="td text-muted-foreground hidden sm:table-cell">{{ channelLabel(t.preferredChannel) }}</td>
              <td class="td hidden md:table-cell"><StatusPill :status="t.status" /></td>
              <td class="td text-muted-foreground hidden md:table-cell tabular-nums">{{ formatTime(t.joinedAt) }}</td>
              <td class="td text-right">
                <span class="text-xs font-bold text-gray-900">Details</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="totalPages > 1"
        class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5"
      >
        <p class="text-xs text-muted-foreground">
          Showing {{ (page - 1) * PER + 1 }}–{{ Math.min(page * PER, rows.length) }} of {{ rows.length }}
        </p>
        <div class="flex items-center gap-1">
          <button
            class="btn btn-outline btn-sm !px-2"
            aria-label="Previous page"
            :disabled="page === 1"
            @click="page = Math.max(1, page - 1)"
          >
            <ChevronLeft class="h-4 w-4" />
          </button>
          <button
            v-for="p in totalPages"
            :key="p"
            @click="page = p"
            :aria-current="page === p ? 'page' : undefined"
            :class="[
              'grid h-8 w-8 place-items-center text-xs font-bold transition-colors',
              page === p ? 'text-foreground' : 'text-muted-foreground hover:bg-muted',
            ]"
          >
            {{ p }}
          </button>
          <button
            class="btn btn-outline btn-sm !px-2"
            aria-label="Next page"
            :disabled="page === totalPages"
            @click="page = Math.min(totalPages, page + 1)"
          >
            <ChevronRight class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>