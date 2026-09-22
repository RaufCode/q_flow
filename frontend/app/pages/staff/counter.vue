<script setup lang="ts">
import { Loader2, Unlink, Copy, Check, ArrowRight } from 'lucide-vue-next'
import { apiGet, apiPost } from '~/utils/api'
import { getCounterRegistry, getCounterIdFallback, type CounterRegistry } from '~/utils/counterRegistry'

definePageMeta({ layout: false })

const { user, logout, setUser } = useAuth()

interface StaffedCounterInfo {
  id?: string
  activeCounter: string
  counterName?: string
  counterNumber: number
  isOnline: boolean
}

const counters = ref<StaffedCounterInfo[]>([])
const loading = ref(true)
const binding = ref(false)
const errorMsg = ref('')
const copied = ref(false)
const selectedNumber = ref<number | null>(null)

const activeCounter = computed(() => user.value?.activeCounter ?? null)

const registry = ref<CounterRegistry>({})

const loadCounters = async () => {
  loading.value = true
  try {
    const res = await apiGet<{ counters: StaffedCounterInfo[] }>('/staff/counters')
    counters.value = res.counters || []
  } catch (err: any) {
    errorMsg.value = err?.message || 'Could not load counters.'
  } finally {
    loading.value = false
  }
}

const loadRegistry = () => {
  registry.value = getCounterRegistry()
}

onMounted(async () => {
  await loadCounters()
  loadRegistry()
})

const counterIdFor = (c: StaffedCounterInfo): string =>
  c.id || registry.value[c.counterNumber]?.id || getCounterIdFallback(c.counterNumber)

const bindCounter = async (c: StaffedCounterInfo) => {
  if (binding.value || !c.isOnline) return
  selectedNumber.value = c.counterNumber
  const counterId = counterIdFor(c)
  if (!counterId) {
    errorMsg.value = 'This counter is not ready yet. Try again in a moment.'
    return
  }
  binding.value = true
  errorMsg.value = ''
  try {
    const res = await apiPost<{ message: string; counter: any }>('/auth/bind-shift', { counterId })
    if (user.value) setUser({ ...user.value, activeCounter: res.counter })
    navigateTo('/staff')
  } catch (err: any) {
    errorMsg.value = err?.message || 'Failed to start your shift.'
  } finally {
    binding.value = false
  }
}

const handleUnbind = async () => {
  try {
    await logout()
  } finally {
    navigateTo('/')
  }
}

const continueToDashboard = () => navigateTo('/staff')

const copyId = async () => {
  if (!activeCounter.value) return
  try {
    await navigator.clipboard.writeText(activeCounter.value.id)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // clipboard unavailable
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg-page flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="bg-card rounded-2xl border border-border p-8 shadow-sm">
        <div class="mb-7 text-center">
          <QFlowLogo />
          <h2 class="text-xl font-bold text-foreground mt-5">Select Your Counter</h2>
          <p class="text-sm text-muted-foreground mt-1">Choose the counter you'll operate today.</p>
        </div>

        <!-- Already bound -->
        <div v-if="activeCounter" class="space-y-4">
          <div class="flex items-center justify-between p-4 rounded-xl border border-primary bg-primary-lighter">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-md flex items-center justify-center font-bold text-sm bg-primary text-white">
                {{ activeCounter.counterNumber }}
              </div>
              <div>
                <p class="font-semibold text-sm text-primary-dark-text">{{ activeCounter.counterName }}</p>
                <p class="text-xs text-muted-foreground">Counter {{ activeCounter.counterNumber }} · Active shift</p>
              </div>
            </div>
            <Check class="w-4 h-4 text-primary" />
          </div>

          <div class="flex items-center justify-between text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
            <span class="truncate mr-2">Counter ID: {{ activeCounter.id }}</span>
            <button class="inline-flex items-center gap-1 font-semibold text-primary hover:underline flex-shrink-0" @click="copyId">
              <component :is="copied ? Check : Copy" class="w-3.5 h-3.5" />
              {{ copied ? 'Copied' : 'Copy' }}
            </button>
          </div>

          <button
            class="w-full inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-all duration-150 bg-primary text-white hover:bg-primary-hover px-5 py-3 text-base"
            @click="continueToDashboard"
          >
            Continue to Dashboard
            <ArrowRight class="w-4 h-4" />
          </button>
          <button
            class="w-full inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-all duration-150 bg-transparent text-foreground hover:bg-muted border border-border px-5 py-2.5 text-sm"
            @click="handleUnbind"
          >
            <Unlink class="w-4 h-4" />
            End Shift
          </button>
        </div>

        <!-- Binding flow -->
        <template v-else>
          <div v-if="errorMsg" class="flex items-start gap-2.5 p-3 mb-4 bg-danger-light border border-danger-light-border rounded-md">
            <p class="text-sm text-danger">{{ errorMsg }}</p>
          </div>

          <div class="mb-5">
            <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Available counters &amp; tellers
            </p>
            <div v-if="loading" class="space-y-2">
              <Skeleton v-for="i in 4" :key="i" class="h-16 rounded-xl" />
            </div>
            <div v-else class="grid grid-cols-1 gap-2">
              <button
                v-for="c in counters"
                :key="c.counterNumber"
                type="button"
                :disabled="binding || !c.isOnline"
                :class="[
                  'flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-150',
                  !c.isOnline
                    ? 'border-border bg-bg-page opacity-60 cursor-not-allowed'
                    : selectedNumber === c.counterNumber
                      ? 'border-primary bg-primary-lighter cursor-pointer'
                      : 'border-border bg-bg-page hover:border-primary/60 cursor-pointer',
                ]"
                @click="bindCounter(c)"
              >
                <div class="flex items-center gap-3">
                  <div
                    :class="[
                      'w-9 h-9 rounded-md flex items-center justify-center font-bold text-sm',
                      selectedNumber === c.counterNumber ? 'bg-primary text-white' : 'bg-muted text-foreground',
                    ]"
                  >
                    {{ c.counterNumber }}
                  </div>
                  <div class="text-left">
                    <p class="font-semibold text-sm text-foreground">{{ c.activeCounter }}</p>
                    <p class="text-xs text-muted-foreground">Counter {{ c.counterNumber }}</p>
                  </div>
                </div>
                <span
                  :class="[
                    'inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1',
                    c.isOnline ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                  ]"
                >
                  <span :class="['h-1.5 w-1.5 rounded-full', c.isOnline ? 'bg-success' : 'bg-muted-foreground']" />
                  {{ c.isOnline ? 'Active' : 'Offline' }}
                </span>
              </button>
              <p v-if="!loading && counters.length === 0" class="text-xs text-muted-foreground">
                No counters configured yet. Ask your administrator to add one.
              </p>
            </div>
          </div>

          <div
            v-if="binding"
            class="flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary-lighter px-4 py-3 text-sm font-semibold text-primary-dark-text"
          >
            <Loader2 class="h-4 w-4 animate-spin" />
            Starting your shift…
          </div>
        </template>
      </div>
    </div>
  </div>
</template>