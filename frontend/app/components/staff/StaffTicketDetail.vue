<script setup lang="ts">
import { MessageSquare, Phone, Bell, Loader2, ArrowLeft, User, ListOrdered, Clock3, XCircle, SkipForward, Play } from 'lucide-vue-next'
import { formatTime, formatDate, formatDateTime, channelLabel } from '~/utils/format'

defineEmits<{ back: [] }>()

const { overview, sessionTickets, recallTicket, startService, completeService, noShowTicket, skipTicket } = useStaffSession()
const showToast = inject<(msg: string) => void>('showToast', () => {})
const selectedTicketId = inject<Ref<string | null>>('selectedTicketId', ref(null))

const ticket = computed(() => {
  if (!selectedTicketId.value) return null
  if (overview.value?.activeTicket?.id === selectedTicketId.value) return overview.value.activeTicket
  return sessionTickets.value.find((t) => t.id === selectedTicketId.value) ?? null
})

const inQueue = computed(() => ticket.value ? ['WAITING', 'CALLED'].includes(ticket.value.status) : false)

const acting = ref(false)
const errorMsg = ref('')

watch(ticket, () => { errorMsg.value = '' })

const channelIcon = computed(() => {
  if (ticket.value?.preferredChannel === 'WHATSAPP') return MessageSquare
  if (ticket.value?.preferredChannel === 'SMS') return Phone
  return Bell
})

const run = async (fn: (id: string) => Promise<any>, message: (t: any) => string) => {
  if (!ticket.value) return
  acting.value = true
  errorMsg.value = ''
  try {
    const updated = await fn(ticket.value.id)
    showToast(message(updated))
  } catch (err: any) {
    errorMsg.value = err?.message || 'Action failed.'
    showToast(errorMsg.value)
  } finally {
    acting.value = false
  }
}

const ticketNumber = (t: any) => t?.ticketNumber ?? ticket.value?.ticketNumber ?? ''
const handleRecall = () => run(recallTicket, (t) => `${ticketNumber(t)} re-notified`)
const handleStart = () => run(startService, (t) => `${ticketNumber(t)} — service started`)
const handleComplete = () => run(completeService, (t) => `${ticketNumber(t)} completed`)
const handleNoShow = () => run(noShowTicket, (t) => `${ticketNumber(t)} marked as no-show`)
const handleSkip = () => run(skipTicket, (t) => `${ticketNumber(t)} skipped to back of queue`)

const timeline = computed(() => {
  if (!ticket.value) return []
  return [
    { label: 'Joined the queue', time: ticket.value.joinedAt, key: 'joinedAt' },
    { label: 'Called to counter', time: ticket.value.calledAt, key: 'calledAt' },
    { label: 'Service started', time: ticket.value.servicedAt, key: 'servicedAt' },
    { label: 'Skipped', time: ticket.value.skippedAt, key: 'skippedAt' },
    { label: 'Completed', time: ticket.value.completedAt, key: 'completedAt' },
    { label: 'Cancelled / No Show', time: ticket.value.cancelledAt, key: 'cancelledAt' },
  ].filter((e) => e.time)
})
</script>

<template>
  <div v-if="ticket" class="space-y-5">
    <button
      class="btn btn-sm btn-outline !px-3"
      @click="$emit('back')"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to Queue
    </button>

    <!-- Ticket hero -->
    <div class="card border-primary-border/60 gradient-brand-soft relative overflow-hidden p-6 dark:border-primary-border">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-[11px] font-bold uppercase tracking-wider text-primary-dark-text dark:text-primary">Ticket</p>
          <div class="mt-1 text-5xl font-extrabold leading-none tracking-tight text-foreground tabular-nums sm:text-6xl">
            {{ ticket.ticketNumber }}
          </div>
          <p class="mt-3 text-sm text-muted-foreground">Joined at {{ formatTime(ticket.joinedAt) }} &middot; {{ formatDate(ticket.joinedAt) }}</p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <StatusPill :status="ticket.status" />
          <span v-if="inQueue && ticket.estimatedWaitTimeMinutes > 0" class="text-xs text-muted-foreground">
            Est. wait ~{{ ticket.estimatedWaitTimeMinutes }} min
          </span>
        </div>
      </div>
    </div>

    <!-- Cards grid -->
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <!-- Customer -->
      <div class="card p-5">
        <h3 class="mb-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Customer</h3>
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <User class="h-5 w-5" />
            </span>
            <div class="min-w-0">
              <p class="text-xs text-muted-foreground">Name</p>
              <p class="truncate text-sm font-semibold text-foreground">{{ ticket.customerName }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <component :is="channelIcon" class="h-5 w-5" />
            </span>
            <div class="min-w-0">
              <p class="text-xs text-muted-foreground">Notifications ({{ channelLabel(ticket.preferredChannel) }})</p>
              <p class="truncate text-sm font-semibold text-foreground">{{ ticket.phoneNumber }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Ticket details -->
      <div class="card p-5">
        <h3 class="mb-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ticket Details</h3>
        <dl class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <dt class="flex items-center gap-2 text-xs text-muted-foreground">
              <ListOrdered class="h-4 w-4" />
              Queue position
            </dt>
            <dd class="text-sm font-bold text-foreground tabular-nums">
              {{ inQueue ? (ticket.currentPosition > 0 ? ticket.currentPosition : 'N/A') : 'Served' }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 class="h-4 w-4" />
              Estimated wait
            </dt>
            <dd class="text-sm font-bold text-foreground tabular-nums">
              {{ inQueue && ticket.estimatedWaitTimeMinutes > 0 ? `~${ticket.estimatedWaitTimeMinutes} min` : 'N/A' }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="flex items-center gap-2 text-xs text-muted-foreground">
              <SkipForward class="h-4 w-4" />
              Skip count
            </dt>
            <dd class="text-sm font-bold text-foreground tabular-nums">{{ ticket.skipCount || 0 }} / 3</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="flex items-center gap-2 text-xs text-muted-foreground">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Joined
            </dt>
            <dd class="text-sm font-bold text-foreground tabular-nums">{{ formatDateTime(ticket.joinedAt) }}</dd>
          </div>
        </dl>
      </div>

      <!-- Timeline -->
      <div v-if="timeline.length > 0" class="card p-5">
        <h3 class="mb-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Timeline</h3>
        <ol class="relative ml-1 space-y-4 border-l border-border pl-5">
          <li v-for="e in timeline" :key="e.key" class="relative">
            <span
              :class="[
                'absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-card',
                e.key === 'completedAt'
                  ? 'bg-success'
                  : e.key === 'skippedAt' || e.key === 'cancelledAt'
                    ? 'bg-danger'
                    : 'bg-primary',
              ]"
            />
            <p class="text-sm font-semibold text-foreground">{{ e.label }}</p>
            <p class="text-xs text-muted-foreground tabular-nums">{{ formatDateTime(e.time) }}</p>
          </li>
        </ol>
      </div>

      <!-- Actions -->
      <div class="card p-5">
        <h3 class="mb-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Actions</h3>

        <template v-if="['CALLED', 'IN_SERVICE'].includes(ticket.status)">
          <div class="flex flex-wrap gap-3">
            <button
              v-if="ticket.status === 'IN_SERVICE'"
              :disabled="acting"
              class="btn btn-md btn-primary flex-1"
              @click="handleComplete"
            >
              <Loader2 v-if="acting" class="h-4 w-4 animate-spin" />
              Complete
            </button>
            <button
              v-if="ticket.status === 'CALLED'"
              :disabled="acting"
              class="btn btn-md btn-primary flex-1"
              @click="handleStart"
            >
              <Loader2 v-if="acting" class="h-4 w-4 animate-spin" />
              <Play v-else class="h-4 w-4" />
              Start
            </button>
            <button
              :disabled="acting"
              class="btn btn-md btn-outline flex-1"
              @click="handleRecall"
            >
              <Loader2 v-if="acting" class="h-4 w-4 animate-spin" />
              <Bell v-else class="h-4 w-4" />
              Recall
            </button>
            <button
              v-if="ticket.status === 'CALLED'"
              :disabled="acting"
              class="btn btn-md btn-ghost-danger"
              @click="handleNoShow"
            >
              <Loader2 v-if="acting" class="h-4 w-4 animate-spin" />
              <XCircle v-else class="h-4 w-4" />
              No Show
            </button>
            <button
              :disabled="acting"
              class="btn btn-md btn-outline"
              @click="handleSkip"
            >
              <Loader2 v-if="acting" class="h-4 w-4 animate-spin" />
              <SkipForward v-else class="h-4 w-4" />
              Skip
            </button>
          </div>
        </template>

        <template v-else-if="ticket.status === 'WAITING'">
          <div class="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            This ticket is waiting in the queue. Use <span class="font-semibold text-foreground">Call Next</span> on the queue page to bring them to your counter.
          </div>
        </template>

        <template v-else>
          <div class="flex items-center gap-2.5 rounded-xl bg-muted p-3.5">
            <svg class="h-4 w-4 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-sm text-muted-foreground">No further actions available for this ticket.</p>
          </div>
        </template>

        <p v-if="errorMsg" class="mt-3 text-xs text-danger">{{ errorMsg }}</p>
      </div>
    </div>
  </div>

  <div v-else class="space-y-5">
    <button class="btn btn-sm btn-outline !px-3" @click="$emit('back')">
      <ArrowLeft class="h-4 w-4" />
      Back to Queue
    </button>
    <div class="card p-10 text-center text-sm text-muted-foreground">No ticket selected.</div>
  </div>
</template>