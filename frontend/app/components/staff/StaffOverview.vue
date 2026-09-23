<script setup lang="ts">
import {
  Users,
  MonitorPlay,
  CheckCircle2,
  ListChecks,
  ArrowRight,
  UserPlus,
  Bell,
  SkipForward,
  XCircle,
} from 'lucide-vue-next'
import { formatTime } from '~/utils/format'

defineEmits<{ goToQueue: [] }>()

const { overview, sessionTickets, loading } = useStaffSession()

const waiting = computed(() => overview.value?.waiting?.length ?? 0)
const activeTicket = computed(() => overview.value?.activeTicket ?? null)
const servedCount = computed(() => sessionTickets.value.filter((t) => t.status === 'SERVED').length)
const handledCount = computed(() => sessionTickets.value.filter((t) => !['WAITING', 'CALLED'].includes(t.status)).length)
const counterLabel = computed(() => overview.value?.counter?.counterName || 'No counter bound')
const greeting = ref('')

onMounted(() => {
  const h = new Date().getHours()
  greeting.value = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
})

const queueLoad = computed(() => Math.min(100, Math.round((waiting.value / 20) * 100)))
const completionRate = computed(() =>
  handledCount.value + waiting.value + (activeTicket.value ? 1 : 0) > 0
    ? Math.round((servedCount.value / (handledCount.value + waiting.value + (activeTicket.value ? 1 : 0))) * 100)
    : 0,
)

const activityMark = (status: string) =>
  ({
    SERVED: CheckCircle2,
    CANCELLED: XCircle,
    AUTO_CANCELLED: XCircle,
    IN_SERVICE: MonitorPlay,
    SKIPPED: SkipForward,
    CALLED: Bell,
  } as Record<string, any>)[status] || UserPlus

const activityText = (status: string) =>
  ({
    CALLED: 'was called',
    IN_SERVICE: 'service started',
    SERVED: 'was served',
    SKIPPED: 'was skipped',
    CANCELLED: 'cancelled their ticket',
    AUTO_CANCELLED: 'ticket auto-cancelled',
  } as Record<string, string>)[status] || 'updated'

const activityTime = (t: any) =>
  t.completedAt || t.cancelledAt || t.skippedAt || t.servicedAt || t.calledAt || t.joinedAt || ''

const activityItems = computed(() =>
  [...sessionTickets.value]
    .sort((a, b) => new Date(activityTime(b)).getTime() - new Date(activityTime(a)).getTime())
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      ticket: t.ticketNumber,
      customer: t.customerName,
      status: t.status,
      icon: activityMark(t.status),
      text: activityText(t.status),
      time: formatTime(activityTime(t)),
    })),
)
</script>

<template>
  <div v-if="loading && !overview" class="space-y-6">
    <div class="space-y-2">
      <Skeleton class="h-7 w-52" />
      <Skeleton class="h-4 w-64" />
    </div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Skeleton v-for="i in 4" :key="i" class="h-32 rounded-2xl" />
    </div>
    <Skeleton class="h-64" />
  </div>

  <div v-else class="space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-xl font-extrabold tracking-tight text-foreground">{{ greeting }}</h2>
        <p class="mt-0.5 text-sm text-muted-foreground">
          Operating <span class="font-semibold text-foreground">{{ counterLabel }}</span>
        </p>
      </div>
      <button
        class="btn btn-sm btn-outline gap-1.5"
        @click="$emit('goToQueue')"
      >
        Manage queue
        <ArrowRight class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- KPI row -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Waiting" :value="waiting" sub="customers in queue" :icon="Users" tone="primary" :progress="queueLoad" />
      <StatCard
        label="At Counter"
        :value="activeTicket ? 1 : 0"
        sub="being served right now"
        :icon="MonitorPlay"
        tone="warning"
        :progress="activeTicket ? 100 : 0"
      />
      <StatCard label="Served" :value="servedCount" sub="this session" :icon="CheckCircle2" tone="success" :progress="completionRate" />
      <StatCard label="Handled" :value="handledCount" sub="served, skipped, or cancelled" :icon="ListChecks" tone="neutral" />
    </div>

    <!-- Recent activity -->
    <div class="card overflow-hidden">
      <div class="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h3 class="text-sm font-bold text-foreground">Recent Activity</h3>
        <span class="text-xs font-semibold text-muted-foreground">
          {{ activeTicket ? activeTicket.ticketNumber + ' at counter' : 'no one at counter' }}
        </span>
      </div>
      <ul v-if="activityItems.length > 0" class="divide-y divide-border">
        <li v-for="item in activityItems" :key="item.id" class="flex items-center gap-3 px-5 py-3">
          <span class="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
            <component :is="item.icon" class="h-4 w-4" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-foreground">
              <span class="font-extrabold tabular-nums">{{ item.ticket }}</span>
              &middot; {{ item.customer }}
            </p>
            <p class="truncate text-xs text-muted-foreground">{{ item.text }}</p>
          </div>
          <span class="flex-shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">{{ item.time }}</span>
        </li>
      </ul>
      <div v-else class="flex flex-col items-center px-5 py-14 text-center">
        <span class="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-muted">
          <UserPlus class="h-5 w-5 text-muted-foreground" />
        </span>
        <p class="text-sm font-semibold text-foreground">No activity yet</p>
        <p class="mt-1 max-w-xs text-xs text-muted-foreground">
          Call the next customer to start tracking your activity this session.
        </p>
      </div>
    </div>
  </div>
</template>