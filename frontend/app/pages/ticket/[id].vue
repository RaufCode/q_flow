<script setup lang="ts">
import { apiGet, apiPost } from '~/utils/api'
import { formatTime } from '~/utils/format'

definePageMeta({ layout: 'customer' })

const route = useRoute()
const ticketId = computed(() => String(route.params.id))

interface StatusTicket {
  id: string
  ticketNumber: string
  customerName: string
  status: string
  currentPosition: number
  estimatedWaitTimeMinutes: number
  skipCount: number
  counter: { counterNumber: number; counterName: string } | null
}

const ticket = ref<StatusTicket | null>(null)
const initialPosition = ref<number | null>(null)
const loading = ref(true)
const errorMsg = ref('')
const cancelling = ref(false)

const loadStoredTicket = () => {
  if (!import.meta.client) return
  try {
    const raw = localStorage.getItem(`qflow_ticket_${ticketId.value}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      initialPosition.value = parsed?.initialPosition ?? null
    }
  } catch {
    // ignore malformed storage
  }
}

const fetchStatus = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    const res = await apiGet<{ ticket: StatusTicket }>(`/tickets/${ticketId.value}/status`)
    ticket.value = res.ticket
    errorMsg.value = ''
  } catch (err: any) {
    if (!silent) errorMsg.value = err?.message || 'We could not load your ticket.'
  } finally {
    loading.value = false
  }
}

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  loadStoredTicket()
  fetchStatus()
  timer = setInterval(() => fetchStatus(true), 5000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const status = computed(() => ticket.value?.status || 'WAITING')
const isCalled = computed(() => status.value === 'CALLED')
const isInService = computed(() => status.value === 'IN_SERVICE')
const isWaiting = computed(() => status.value === 'WAITING')
const isFinal = computed(() =>
  ['SERVED', 'CANCELLED', 'AUTO_CANCELLED'].includes(status.value),
)
const isNear = computed(() => isWaiting.value && (ticket.value?.currentPosition ?? 99) <= 2)
const canCancel = computed(() => isWaiting.value || isCalled.value)

const position = computed(() => (isWaiting.value ? ticket.value?.currentPosition ?? 0 : 0))
const waitMin = computed(() => (isWaiting.value ? ticket.value?.estimatedWaitTimeMinutes ?? 0 : 0))
const progress = computed(() => {
  if (!initialPosition.value || initialPosition.value <= 0) return isNear.value ? 80 : 40
  const start = initialPosition.value
  const remaining = ticket.value?.currentPosition ?? start
  const done = Math.min(100, Math.max(0, ((start - remaining) / start) * 100))
  return done
})

const headerTitle = computed(() => {
  switch (status.value) {
    case 'CALLED': return "It's Your Turn!"
    case 'IN_SERVICE': return 'You are being served'
    case 'SERVED': return 'Thanks for visiting!'
    case 'CANCELLED':
    case 'AUTO_CANCELLED': return 'Ticket Cancelled'
    default: return isNear.value ? "You're Almost Up!" : "You're in the queue"
  }
})

const headerSub = computed(() => {
  switch (status.value) {
    case 'CALLED':
      return ticket.value?.counter
        ? `Please proceed to ${ticket.value.counter.counterName} (Counter ${ticket.value.counter.counterNumber})`
        : 'Please proceed to the counter area.'
    case 'IN_SERVICE':
      return 'Your service is currently in progress.'
    case 'SERVED':
      return 'Your ticket has been completed successfully.'
    case 'CANCELLED':
    case 'AUTO_CANCELLED':
      return 'This ticket is no longer active in the queue.'
    default:
      return isNear.value
        ? 'Please get ready and head to the counter area.'
        : "We'll notify you when it's almost your turn."
  }
})

const handleCancel = async () => {
  cancelling.value = true
  try {
    await apiPost(`/tickets/${ticketId.value}/cancel`)
    if (import.meta.client) {
      localStorage.removeItem(`qflow_ticket_${ticketId.value}`)
      localStorage.removeItem('qflow_current_ticket')
    }
    navigateTo('/ticket/goodbye')
  } catch (err: any) {
    errorMsg.value = err?.message || 'We could not cancel your ticket.'
  } finally {
    cancelling.value = false
  }
}

const leaveQueue = () => {
  if (import.meta.client) {
    localStorage.removeItem(`qflow_ticket_${ticketId.value}`)
    localStorage.removeItem('qflow_current_ticket')
  }
  navigateTo('/ticket/goodbye')
}

const startOver = () => {
  if (import.meta.client) localStorage.removeItem(`qflow_ticket_${ticketId.value}`)
  navigateTo('/ticket-registration')
}
</script>

<template>
  <div>
    <div :class="['px-5 pt-5 pb-5 transition-colors', isCalled || isInService ? 'bg-bg-called' : isNear ? 'bg-primary-lighter' : 'bg-card border-b border-border']">
      <div class="flex items-center justify-between mb-5">
        <QFlowLogo />
        <div
          :class="[
            'flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full',
            isCalled || isInService ? 'bg-white/20 text-white' : 'bg-primary-light text-primary'
          ]"
        >
          <div :class="['w-1.5 h-1.5 rounded-full animate-pulse', isCalled || isInService ? 'bg-white' : 'bg-primary']" />
          Live
        </div>
      </div>
      <div v-if="isCalled || isInService">
        <p class="text-lg font-bold text-white">{{ headerTitle }}</p>
        <p class="text-sm text-white/80 mt-0.5">{{ headerSub }}</p>
      </div>
      <div v-else>
        <p class="text-base font-bold text-foreground">{{ headerTitle }}</p>
        <p class="text-sm text-muted-foreground mt-0.5">{{ headerSub }}</p>
      </div>
    </div>

    <div v-if="loading && !ticket" class="p-6 space-y-5">
      <div class="flex flex-col items-center py-6 gap-2.5">
        <Skeleton class="h-3 w-24" />
        <Skeleton class="h-14 w-40" />
        <Skeleton class="h-4 w-32 mt-1" />
        <Skeleton class="h-1.5 w-full max-w-64" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <Skeleton class="h-24 rounded-xl" />
        <Skeleton class="h-24 rounded-xl" />
      </div>
      <Skeleton class="h-11 rounded-xl" />
    </div>

    <div v-else-if="!ticket" class="p-6">
      <div class="bg-danger-light border border-danger-light-border rounded-xl p-5 text-center">
        <p class="text-sm font-semibold text-danger">{{ errorMsg || 'Ticket not found.' }}</p>
        <button class="mt-4 text-sm font-bold text-primary hover:underline" @click="startOver">Join the queue again</button>
      </div>
    </div>

    <template v-else>
      <div :class="['flex flex-col items-center py-8 border-b border-border', (isNear || isCalled || isInService) && 'bg-bg-ticket']">
        <p class="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Your Ticket</p>
        <div :class="['text-6xl font-extrabold leading-none tracking-tight tabular-nums', (isNear || isCalled || isInService) ? 'text-primary' : 'text-foreground']">
          {{ ticket.ticketNumber }}
        </div>
        <p class="text-sm text-muted-foreground mt-3">{{ ticket.customerName }}</p>
        <div v-if="isWaiting" class="w-full px-6 mt-6">
          <div class="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Position {{ position }}</span>
            <span>{{ Math.round(progress) }}% through the line</span>
          </div>
          <div class="h-1.5 bg-muted rounded-full overflow-hidden">
            <div class="h-full bg-primary rounded-full transition-all duration-700" :style="{ width: `${Math.max(progress, 4)}%` }" />
          </div>
        </div>
      </div>

      <div v-if="isCalled && ticket.counter" class="flex items-center gap-3 px-5 py-4 bg-primary-lighter border-b border-border">
        <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white flex-shrink-0">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p class="text-sm font-bold text-foreground">{{ ticket.counter.counterName }} is ready for you</p>
          <p class="text-xs text-muted-foreground">Counter {{ ticket.counter.counterNumber }} · Please approach now</p>
        </div>
      </div>

      <div v-if="isInService" class="flex items-center gap-3 px-5 py-4 bg-primary-lighter border-b border-border">
        <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white flex-shrink-0">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-sm font-bold text-foreground">Service in progress</p>
          <p class="text-xs text-muted-foreground">
            {{ ticket.counter?.counterName || 'Your counter' }} · Being served now
          </p>
        </div>
      </div>

      <div v-if="isFinal" class="p-5">
        <div :class="['flex items-center gap-3 p-4 rounded-xl border', status === 'SERVED' ? 'bg-success-light border-success-check' : 'bg-muted border-border']">
          <div :class="['w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0', status === 'SERVED' ? 'bg-success' : 'bg-muted-foreground']">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-bold text-foreground">{{ status === 'SERVED' ? 'Service completed' : 'Ticket cancelled' }}</p>
            <p class="text-xs text-muted-foreground">{{ headerSub }}</p>
          </div>
        </div>
      </div>

      <div v-else class="grid grid-cols-2 divide-x divide-border border-b border-border">
        <div class="p-4 text-center">
          <p class="text-xs font-semibold text-muted-foreground">Position</p>
          <p class="text-2xl font-extrabold text-foreground mt-0.5 tabular-nums">{{ position }}</p>
          <p class="text-xs text-muted-foreground">{{ position === 1 ? 'you are next' : 'customers ahead' }}</p>
        </div>
        <div class="p-4 text-center">
          <p class="text-xs font-semibold text-muted-foreground">Est. Wait</p>
          <p class="text-2xl font-extrabold text-foreground mt-0.5 tabular-nums">~{{ waitMin }}</p>
          <p class="text-xs text-muted-foreground">minutes</p>
        </div>
      </div>

      <div class="flex items-center justify-between px-5 py-3 border-b border-border">
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span class="text-xs text-muted-foreground font-medium">Status</span>
        </div>
        <span class="text-sm font-extrabold text-primary tabular-nums">{{ status.replace('_', ' ') }}</span>
      </div>

      <div class="p-5 space-y-4">
        <div v-if="errorMsg" class="text-xs text-danger">{{ errorMsg }}</div>

        <div v-if="canCancel" class="space-y-3">
        <button
          class="w-full inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 px-4 py-2.5 text-sm bg-transparent text-foreground hover:bg-muted active:bg-border border border-border"
          @click="leaveQueue"
        >Leave Queue</button>

        <button
          :disabled="cancelling"
          class="w-full inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 px-4 py-2.5 text-sm bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-50"
          @click="handleCancel"
        >{{ cancelling ? 'Cancelling…' : 'Cancel Ticket' }}</button>
      </div>

      <button
        v-else
        class="w-full inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-all duration-150 bg-primary text-white hover:bg-primary-hover px-4 py-2.5 text-sm"
        @click="startOver"
      >Join Queue Again</button>
      </div>
    </template>
  </div>
</template>
