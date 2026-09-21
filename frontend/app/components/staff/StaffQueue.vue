<script setup lang="ts">
import { Loader2, UserCheck, Search, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { formatTime, channelLabel } from '~/utils/format'

const emit = defineEmits<{ selectTicket: [id: string] }>()

const { overview, loading, callNext, completeService, trackTicket, error } = useStaffSession()
const showToast = inject<(msg: string) => void>('showToast', () => {})
const search = ref('')
const filter = ref('')
const calling = ref(false)
const PER = 10
const page = ref(1)

const activeTicket = computed(() => overview.value?.activeTicket ?? null)
const waitingCount = computed(() => overview.value?.waiting?.length ?? 0)

const rows = computed(() => {
  const list = [...(overview.value?.waiting ?? [])]
  const s = search.value.toLowerCase()
  return list.filter((t) => {
    const matchesSearch =
      !s || t.customerName.toLowerCase().includes(s) || t.ticketNumber.toLowerCase().includes(s)
    const matchesFilter = !filter.value || t.status === filter.value
    return matchesSearch && matchesFilter
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(rows.value.length / PER)))
const paginated = computed(() => rows.value.slice((page.value - 1) * PER, page.value * PER))

watch([search, filter], () => (page.value = 1))

const handleCallNext = async () => {
  calling.value = true
  try {
    if (activeTicket.value?.status === 'IN_SERVICE') {
      await completeService(activeTicket.value.id)
    }
    const ticket = await callNext()
    if (ticket) showToast(`Calling ${ticket.ticketNumber} — ${ticket.customerName}`)
  } catch (err: any) {
    showToast(err?.message || 'Failed to call next customer')
  } finally {
    calling.value = false
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
      <div class="flex items-center gap-2">
        <button
          :disabled="calling || waitingCount === 0"
          class="btn btn-sm btn-primary"
          @click="handleCallNext"
        >
          <Loader2 v-if="calling" class="h-3.5 w-3.5 animate-spin" />
          <UserCheck v-else class="h-3.5 w-3.5" />
          {{ calling ? 'Calling…' : 'Call Next' }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row">
      <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="search"
          class="input pl-9"
          placeholder="Search by name or ticket number…"
        />
      </div>
      <select v-model="filter" class="input sm:w-44">
        <option value="">All Statuses</option>
        <option value="WAITING">Waiting</option>
        <option value="CALLED">Called</option>
      </select>
    </div>

    <p v-if="error" class="text-xs text-danger">{{ error }}</p>

    <div class="card overflow-hidden">
      <SkeletonTable v-if="loading && !overview" :rows="7" :cols="5" />
      <div v-else class="overflow-x-auto">
        <table class="table-gmail w-full text-sm">
          <thead class="bg-muted/40">
            <tr class="border-b border-border">
              <th class="th">Ticket</th>
              <th class="th">Customer</th>
              <th class="th hidden sm:table-cell">Channel</th>
              <th class="th">Position</th>
              <th class="th hidden md:table-cell">Joined</th>
              <th class="th text-right"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="rows.length === 0">
              <td colspan="6" class="px-5 py-14 text-center text-muted-foreground">
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
              <td class="td font-extrabold text-gray-900 tabular-nums">{{ t.ticketNumber }}</td>
              <td class="td">
                <p class="truncate font-semibold text-foreground">{{ t.customerName }}</p>
                <p class="text-xs text-muted-foreground">{{ t.phoneNumber }}</p>
              </td>
              <td class="td text-muted-foreground hidden sm:table-cell">{{ channelLabel(t.preferredChannel) }}</td>
              <td class="td text-foreground tabular-nums">
                <span class="text-xs font-bold text-foreground">
                  {{ t.currentPosition > 0 ? t.currentPosition : '0' }}
                </span>
              </td>
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