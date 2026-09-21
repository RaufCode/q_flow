<script setup lang="ts">
import {
  Users,
  Ticket,
  CheckCircle2,
  UserPlus,
  Bell,
  MonitorPlay,
  SkipForward,
  XCircle,
} from 'lucide-vue-next'
import { apiGet } from '~/utils/api'
import { formatTime } from '~/utils/format'

interface OverviewStats {
  totalToday: number
  servedToday: number
  waitingNow: number
  activeCounters: number
  countersTotal: number
  staffTotal: number
  staffOnShift: number
  servedTotal: number
  avgWaitMin: number
}

interface SystemAnalytics {
  date: string
  totalTicketsToday: number
  avgWaitTimeMinutes: number | null
  avgServiceTimeMinutes: number | null
  statusBreakdown: Record<string, number>
}

interface StaffEfficiency {
  staffId: string
  employeeId: string
  fullName: string
  activeCounter: string
  totalTicketsServedToday: number
  avgHandlingTimeMinutes: number | null
}

interface OverviewCounter {
  id: string
  counterNumber: number
  counterName: string
  isActive: boolean
  currentStaff: { id: string; employeeId: string; fullName: string; role: string } | null
}

interface OverviewTicket {
  id: string
  ticketNumber: string
  customerName: string
  status: string
  joinedAt: string
  calledAt: string | null
  servicedAt: string | null
  completedAt: string | null
  skippedAt: string | null
  cancelledAt: string | null
  counter: { counterNumber: number; counterName: string } | null
}

const stats = ref<OverviewStats | null>(null)
const counters = ref<OverviewCounter[]>([])
const recent = ref<OverviewTicket[]>([])
const loading = ref(true)
const errorMsg = ref('')

const load = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    const [analyticsRes, countersRes, ticketsRes, staffRes] = await Promise.all([
      apiGet<{ analytics: SystemAnalytics }>('/admin/analytics/overview'),
      apiGet<{ counters: OverviewCounter[] }>('/admin/counters'),
      apiGet<{ tickets: OverviewTicket[] }>('/admin/tickets?limit=5'),
      apiGet<{ staffEfficiency: StaffEfficiency[] }>('/admin/analytics/staff-efficiency').catch(
        () => ({ staffEfficiency: [] as StaffEfficiency[] }),
      ),
    ])

    const analytics = analyticsRes.analytics
    const allCounters = countersRes.counters || []
    const staff = staffRes.staffEfficiency || []
    const breakdown = analytics.statusBreakdown || {}

    stats.value = {
      totalToday: analytics.totalTicketsToday ?? 0,
      servedToday: breakdown.SERVED ?? 0,
      waitingNow: breakdown.WAITING ?? 0,
      activeCounters: allCounters.filter((c) => c.isActive).length,
      countersTotal: allCounters.length,
      staffTotal: staff.length,
      staffOnShift: staff.filter((s) => s.activeCounter !== 'Unbound').length,
      servedTotal: breakdown.SERVED ?? 0,
      avgWaitMin: analytics.avgWaitTimeMinutes ?? 0,
    }
    counters.value = allCounters
    recent.value = ticketsRes.tickets || []
    errorMsg.value = ''
  } catch (err: any) {
    if (!silent) errorMsg.value = err?.message || 'Failed to load overview.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
})

const activityMark = (status: string) =>
  ({
    SERVED: CheckCircle2,
    CANCELLED: XCircle,
    AUTO_CANCELLED: XCircle,
    CALLED: Bell,
    IN_SERVICE: MonitorPlay,
    SKIPPED: SkipForward,
    WAITING: UserPlus,
  } as Record<string, any>)[status] || UserPlus

const activityText = (t: OverviewTicket) =>
  ({
    WAITING: 'joined the queue',
    CALLED: 'was called to the counter',
    IN_SERVICE: 'service started',
    SERVED: 'was successfully served',
    SKIPPED: 'was skipped',
    CANCELLED: 'cancelled their ticket',
    AUTO_CANCELLED: 'ticket auto-cancelled',
  } as Record<string, string>)[t.status] || 'updated'

const activityTime = (t: OverviewTicket) =>
  t.completedAt || t.cancelledAt || t.skippedAt || t.servicedAt || t.calledAt || t.joinedAt || ''

const activityItems = computed(() =>
  recent.value.slice(0, 5).map((t) => ({
    id: t.id,
    ticket: t.ticketNumber,
    customer: t.customerName,
    status: t.status,
    icon: activityMark(t.status),
    text: activityText(t),
    time: formatTime(activityTime(t)),
    counter: t.counter ? `${t.counter.counterName} #${t.counter.counterNumber}` : '',
  })),
)
</script>

<template>
  <div class="space-y-5">
    <div>
      <h2 class="text-xl font-extrabold tracking-tight text-foreground">Overview</h2>
      <p class="mt-0.5 text-sm text-muted-foreground">
        Live metrics for today's branch activity
      </p>
    </div>

    <p v-if="errorMsg" class="text-xs text-danger">{{ errorMsg }}</p>

    <!-- KPI row -->
    <div v-if="loading && !stats" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="card p-5">
        <div class="relative flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1 space-y-2">
            <Skeleton class="h-3 w-20" />
            <Skeleton class="h-8 w-16" />
          </div>
          <Skeleton class="h-11 w-11 rounded-xl" />
        </div>
        <Skeleton class="mt-3 h-3 w-28" />
      </div>
    </div>
    <div v-else-if="stats" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Waiting Now" :value="stats.waitingNow" sub="customers in queue" :icon="Users" tone="neutral" />
      <StatCard label="Total Today" :value="stats.totalToday" sub="tickets issued" :icon="Ticket" tone="neutral" />
      <StatCard label="Served Today" :value="stats.servedToday" sub="tickets completed" :icon="CheckCircle2" tone="neutral" />
    </div>

    <!-- Activity + Counters -->
    <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <!-- Recent activity -->
      <div class="card overflow-hidden">
        <div class="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 class="text-sm font-bold text-foreground">Recent Activity</h3>
          <span class="text-xs font-semibold text-muted-foreground">latest 5</span>
        </div>
        <div v-if="loading && !stats" class="divide-y divide-border">
          <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-5 py-3">
            <Skeleton class="h-9 w-9 flex-shrink-0 rounded-full" />
            <div class="min-w-0 flex-1 space-y-1.5">
              <Skeleton class="h-3.5 w-2/3" />
              <Skeleton class="h-3 w-1/2" />
            </div>
            <Skeleton class="h-3 w-10 flex-shrink-0" />
          </div>
        </div>
        <ul v-else-if="activityItems.length === 0" class="px-5 py-14 text-center text-sm text-muted-foreground">
          No recent activity yet.
        </ul>
        <ul v-else class="divide-y divide-border">
          <li v-for="item in activityItems" :key="item.id" class="flex items-center gap-3 px-5 py-3">
            <span class="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <component :is="item.icon" class="h-4 w-4" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-foreground">
                <span class="font-extrabold tabular-nums">{{ item.ticket }}</span>
                &middot; {{ item.customer }}
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {{ item.text }}
                <span v-if="item.counter" class="hidden sm:inline"> &middot; {{ item.counter }}</span>
              </p>
            </div>
            <span class="flex-shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">{{ item.time }}</span>
          </li>
        </ul>
      </div>

      <!-- Counters -->
      <div class="card overflow-hidden">
        <div class="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 class="text-sm font-bold text-foreground">Counters</h3>
          <span v-if="stats" class="text-xs font-semibold text-muted-foreground tabular-nums">
            {{ stats.activeCounters }} / {{ stats.countersTotal }} active
          </span>
        </div>
        <div v-if="loading && !stats" class="overflow-x-auto">
          <div class="grid grid-cols-3 items-center gap-6 border-b border-border bg-muted/40 px-5 py-3.5">
            <Skeleton v-for="h in 3" :key="h" class="h-3 w-16" />
          </div>
          <div class="divide-y divide-border">
            <div v-for="r in 4" :key="r" class="grid grid-cols-3 items-center gap-6 px-5 py-3.5">
              <div class="flex items-center gap-3">
                <Skeleton class="h-5 w-7" />
                <Skeleton class="h-4 w-28" />
              </div>
              <Skeleton class="h-4 w-16" />
              <Skeleton class="h-4 w-20" />
            </div>
          </div>
        </div>
        <div v-else-if="counters.length === 0" class="px-5 py-14 text-center text-sm text-muted-foreground">
          No counters configured yet.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="table-gmail w-full text-sm">
            <thead class="bg-muted/40">
              <tr class="border-b border-border">
                <th class="th">Counter</th>
                <th class="th">Status</th>
                <th class="th hidden md:table-cell">Staff</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <tr v-for="c in counters" :key="c.id">
                <td class="td">
                  <div class="flex items-center gap-3">
                    <span class="text-sm font-bold text-foreground tabular-nums">
                      {{ String(c.counterNumber).padStart(2, '0') }}
                    </span>
                    <span class="truncate font-semibold text-foreground">{{ c.counterName }}</span>
                  </div>
                </td>
                <td class="td">
                  <span
                    :class="[
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
                      c.isActive ? 'bg-primary-light text-primary-dark-text' : 'bg-muted text-muted-foreground',
                    ]"
                  >
                    <span :class="['h-1.5 w-1.5 rounded-full', c.isActive ? 'bg-primary' : 'bg-muted-foreground']" />
                    {{ c.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="td text-muted-foreground hidden md:table-cell font-mono text-xs">
                  {{ c.currentStaff ? c.currentStaff.employeeId : 'Unassigned' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>