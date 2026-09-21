<script setup lang="ts">
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-vue-next'
import { formatTime, formatDate } from '~/utils/format'

const { history } = useStaffSession()
const filter = ref('')
const page = ref(1)
const PER = 10

const finalStatuses = ['SERVED', 'SKIPPED', 'CANCELLED', 'AUTO_CANCELLED']

const filtered = computed(() =>
  history.value
    .filter((t) => finalStatuses.includes(t.status))
    .filter((t) => !filter.value || t.status === filter.value),
)

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PER)))
const paginated = computed(() => filtered.value.slice((page.value - 1) * PER, page.value * PER))

watch(filter, () => (page.value = 1))
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-xl font-extrabold tracking-tight text-foreground">History</h2>
        <p class="mt-0.5 text-sm text-muted-foreground">
          <span class="font-bold text-foreground tabular-nums">{{ filtered.length }}</span> tickets handled this session
        </p>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="filter" class="input sm:w-44">
          <option value="">All statuses</option>
          <option value="SERVED">Served</option>
          <option value="SKIPPED">Skipped</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="AUTO_CANCELLED">Auto Cancelled</option>
        </select>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table-gmail w-full text-sm">
          <thead class="bg-muted/40">
            <tr class="border-b border-border">
              <th class="th">Ticket</th>
              <th class="th">Customer</th>
              <th class="th hidden sm:table-cell">Phone</th>
              <th class="th">Status</th>
              <th class="th hidden md:table-cell">Date</th>
              <th class="th">Completed</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="paginated.length === 0">
              <td colspan="6" class="px-5 py-16 text-center">
                <span class="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-muted">
                  <Inbox class="h-5 w-5 text-muted-foreground" />
                </span>
                <p class="text-sm font-semibold text-foreground">No completed tickets yet</p>
                <p class="mt-1 text-xs text-muted-foreground">
                  Tickets you mark as no-show or cancel this session will appear here.
                </p>
              </td>
            </tr>
            <tr v-for="t in paginated" :key="t.id">
              <td class="td font-extrabold text-gray-900 tabular-nums">{{ t.ticketNumber }}</td>
              <td class="td font-semibold text-foreground">{{ t.customerName }}</td>
              <td class="td text-muted-foreground hidden sm:table-cell">{{ t.phoneNumber }}</td>
              <td class="td"><StatusPill :status="t.status" /></td>
              <td class="td text-muted-foreground hidden md:table-cell tabular-nums">{{ formatDate(t.joinedAt) }}</td>
              <td class="td text-muted-foreground tabular-nums">{{ formatTime(t.completedAt || t.skippedAt || t.cancelledAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="totalPages > 1" class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5">
        <p class="text-xs text-muted-foreground">
          Showing {{ (page - 1) * PER + 1 }}–{{ Math.min(page * PER, filtered.length) }} of {{ filtered.length }}
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