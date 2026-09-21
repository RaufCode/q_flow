<script setup lang="ts">
import { Loader2, Unlink, Copy, Check } from 'lucide-vue-next'
import { apiGet, apiPost } from '~/utils/api'

definePageMeta({ layout: false })

const { user, logout, setUser } = useAuth()

// The deployed /staff/counters endpoint lists only counters that are currently
// staffed, and deliberately omits their IDs — so counter selection here is
// read-only and binding happens through the manual Counter ID entry.
interface StaffedCounterInfo {
  activeCounter: string
  counterNumber: number
  isOnline: boolean
}

const counters = ref<StaffedCounterInfo[]>([])
const manualId = ref('')
const loading = ref(true)
const binding = ref(false)
const errorMsg = ref('')
const copied = ref(false)

const activeCounter = computed(() => user.value?.activeCounter ?? null)

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

onMounted(loadCounters)

const bind = async (counterId: string) => {
  if (!counterId) return
  binding.value = true
  errorMsg.value = ''
  try {
    const res = await apiPost<{ message: string; counter: any }>('/auth/bind-shift', { counterId })
    if (user.value) setUser({ ...user.value, activeCounter: res.counter })
    navigateTo('/staff')
  } catch (err: any) {
    errorMsg.value = err?.message || 'Failed to bind counter.'
  } finally {
    binding.value = false
  }
}

const handleManualBind = () => {
  if (manualId.value.trim()) bind(manualId.value.trim())
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
        <div class="mb-7">
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
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
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

          <div v-if="loading" class="space-y-2 mb-6">
            <Skeleton v-for="i in 3" :key="i" class="h-16 rounded-xl" />
          </div>

          <template v-else>
            <div v-if="counters.length" class="mb-6">
              <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Counters currently staffed
              </p>
              <div class="space-y-2">
                <div
                  v-for="c in counters"
                  :key="c.counterNumber"
                  class="flex items-center justify-between p-3.5 rounded-xl border border-border bg-bg-page"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-md flex items-center justify-center font-bold text-sm bg-muted text-foreground">
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
                    {{ c.isOnline ? 'Online' : 'Offline' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Counter ID entry: the only way to bind on the deployed backend -->
            <div class="mt-4 space-y-3">
              <div class="p-3 bg-primary-lighter border border-primary-border rounded-md">
                <p class="text-xs text-primary-dark-text leading-relaxed">
                  Enter the Counter ID provided by your branch administrator to start your shift.
                </p>
              </div>
              <input
                v-model="manualId"
                class="w-full px-3 py-2.5 rounded-md border border-border bg-input-bg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
                placeholder="Paste Counter ID"
                @keydown.enter="handleManualBind"
              />
            </div>

            <button
              :disabled="!manualId.trim() || binding"
              class="mt-4 w-full inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed select-none bg-primary text-white hover:bg-primary-hover active:bg-primary-active px-5 py-3 text-base"
              @click="handleManualBind"
            >
              <Loader2 v-if="binding" class="w-4 h-4 animate-spin" />
              {{ binding ? 'Starting…' : 'Start Shift' }}
            </button>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
