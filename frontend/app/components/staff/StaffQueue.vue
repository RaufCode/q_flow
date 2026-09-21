<script setup lang="ts">
import { Loader2, UserCheck, Search, Bell, XCircle, Check, SkipForward } from 'lucide-vue-next'
import { formatTime, channelLabel } from '~/utils/format'

const emit = defineEmits<{ selectTicket: [id: string] }>()

const { overview, loading, callNext, recallTicket, completeService, noShowTicket, skipTicket, trackTicket, error } = useStaffSession()
const showToast = inject<(msg: string) => void>('showToast', () => {})
const search = ref('')
const filter = ref('')
const calling = ref(false)
const acting = ref<{ id: string; action: 'recall' | 'no-show' | 'complete' | 'skip' } | null>(null)

const activeTicket = computed(() => overview.value?.activeTicket ?? null)
const waitingCount = computed(() => overview.value?.waitingCount ?? 0)

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

const handleCallNext = async () => {
  calling.value = true
  try {
    if (activeTicket.value && ['CALLED', 'IN_SERVICE'].includes(activeTicket.value.status)) {
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

const handleAction = async (t: any, action: 'recall' | 'no-show' | 'complete' | 'skip') => {
  acting.value = { id: t.id, action }
  try {
    const ticket =
      action === 'recall'
        ? await recallTicket(t.id)
        : action === 'complete'
          ? await completeService(t.id)
          : action === 'skip'
            ? await skipTicket(t.id)
            : await noShowTicket(t.id)
    const verb =
      action === 'recall' ? 're-notified' : action === 'complete' ? 'completed' : action === 'skip' ? 'skipped to back of queue' : 'marked as no-show'
    if (ticket) showToast(`${ticket.ticketNumber} ${verb} — ${ticket.customerName}`)
  } catch (err: any) {
    showToast(err?.message || `Failed to ${action} this customer`)
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

    <div
      v-if="activeTicket"
      class="rounded-2xl border border-primary-border bg-primary-lighter px-4 py-3.5"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <span class="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <UserCheck class="h-4 w-4" />
          </span>
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-wider text-primary">At your counter</p>
            <p class="truncate text-sm font-extrabold text-foreground sm:text-base">
              {{ activeTicket.ticketNumber }} &middot; {{ activeTicket.customerName }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <StatusPill :status="activeTicket.status" />
          <button
            v-if="['CALLED', 'IN_SERVICE'].includes(activeTicket.status)"
            :disabled="acting !== null"
            class="btn btn-sm btn-outline"
            @click="handleAction(activeTicket, 'recall')"
          >
            <Loader2 v-if="acting?.id === activeTicket.id && acting?.action === 'recall'" class="h-3.5 w-3.5 animate-spin" />
            <Bell v-else class="h-3.5 w-3.5" />
            Recall
          </button>
          <button
            v-if="activeTicket.status === 'IN_SERVICE'"
            :disabled="acting !== null"
            class="btn btn-sm btn-primary"
            @click="handleAction(activeTicket, 'complete')"
          >
            <Loader2 v-if="acting?.id === activeTicket.id && acting?.action === 'complete'" class="h-3.5 w-3.5 animate-spin" />
            <Check v-else class="h-3.5 w-3.5" />
            Complete
          </button>
          <button
            v-if="activeTicket.status === 'CALLED'"
            :disabled="acting !== null"
            class="btn btn-sm btn-ghost-danger"
            @click="handleAction(activeTicket, 'no-show')"
          >
            <Loader2 v-if="acting?.id === activeTicket.id && acting?.action === 'no-show'" class="h-3.5 w-3.5 animate-spin" />
            <XCircle v-else class="h-3.5 w-3.5" />
            No Show
          </button>
          <button
            v-if="activeTicket.status === 'CALLED'"
            :disabled="acting !== null"
            class="btn btn-sm btn-outline"
            @click="handleAction(activeTicket, 'skip')"
          >
            <Loader2 v-if="acting?.id === activeTicket.id && acting?.action === 'skip'" class="h-3.5 w-3.5 animate-spin" />
            <SkipForward v-else class="h-3.5 w-3.5" />
            Skip
          </button>
        </div>
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
              v-for="t in rows"
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
    </div>
  </div>
</template>