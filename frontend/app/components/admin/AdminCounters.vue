<script setup lang="ts">
import { Loader2, Unlink, Copy, Check, Plus, X, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { apiGet, apiPost, apiPatch } from '~/utils/api'
import { trim, isValidCounterNumber, isValidCounterName } from '~/utils/validate'

const showToast = inject<(msg: string) => void>('showToast', () => {})

interface Counter {
  id: string
  counterNumber: number
  counterName: string
  isActive: boolean
  currentStaffId: string | null
  currentStaff: { id: string; employeeId: string; fullName: string; role: string } | null
}

const counters = ref<Counter[]>([])
const loading = ref(true)
const errorMsg = ref('')
const showForm = ref(false)
const newNumber = ref<number | null>(null)
const newName = ref('')
const creating = ref(false)
const busyId = ref<string | null>(null)
const copiedId = ref<string | null>(null)
const formErrors = ref({ number: '', name: '' })
const touched = ref<Record<string, boolean>>({})

const PER = 10
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(counters.value.length / PER)))
const paginated = computed(() => counters.value.slice((page.value - 1) * PER, page.value * PER))

const validateForm = () => {
  const errors = { number: '', name: '' }
  const nv = newNumber.value as number | null
  if (!isValidCounterNumber(nv)) {
    errors.number = nv === null || nv === '' ? 'Counter number is required.' : 'Enter a whole number between 1 and 999.'
  } else if (counters.value.some((c) => c.counterNumber === nv)) {
    errors.number = `Counter ${nv} already exists.`
  }
  const name = trim(newName.value)
  if (!name) errors.name = 'Counter name is required.'
  else if (!isValidCounterName(name)) errors.name = 'Counter name must be between 1 and 100 characters.'
  formErrors.value = errors
  return !Object.values(errors).some(Boolean)
}

const validateField = (field: 'number' | 'name') => {
  touched.value[field] = true
  validateForm()
}

const openForm = () => {
  showForm.value = !showForm.value
  newNumber.value = null
  newName.value = ''
  formErrors.value = { number: '', name: '' }
  touched.value = {}
}

const load = async () => {
  loading.value = true
  try {
    const res = await apiGet<{ counters: Counter[] }>('/admin/counters')
    counters.value = res.counters || []
    errorMsg.value = ''
  } catch (err: any) {
    errorMsg.value = err?.message || 'Failed to load counters.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const handleCreate = async () => {
  touched.value = { number: true, name: true }
  if (!validateForm()) return
  creating.value = true
  try {
    const res = await apiPost<{ message: string; counter: Counter }>('/admin/counters', {
      counterNumber: Number(newNumber.value),
      counterName: newName.value.trim(),
    })
    const created = { ...res.counter, currentStaff: null, currentStaffId: null }
    counters.value = [...counters.value, created].sort((a, b) => a.counterNumber - b.counterNumber)
    showToast('Counter created successfully')
    newNumber.value = null
    newName.value = ''
    formErrors.value = { number: '', name: '' }
    showForm.value = false
  } catch (err: any) {
    showToast(err?.message || 'Failed to create counter')
  } finally {
    creating.value = false
  }
}

const handleToggle = async (c: Counter) => {
  busyId.value = c.id
  try {
    const res = await apiPatch<{ message: string; counter: Counter }>(`/admin/counters/${c.id}/toggle`, { isActive: !c.isActive })
    const idx = counters.value.findIndex((x) => x.id === c.id)
    if (idx !== -1) {
      counters.value[idx] = {
        ...counters.value[idx],
        isActive: res.counter.isActive,
        currentStaffId: res.counter.isActive ? counters.value[idx].currentStaffId : null,
        currentStaff: res.counter.isActive ? counters.value[idx].currentStaff : null,
      }
    }
    showToast(`${c.counterName} ${c.isActive ? 'deactivated' : 'activated'}`)
  } catch (err: any) {
    showToast(err?.message || 'Failed to update counter')
  } finally {
    busyId.value = null
  }
}

const handleForceUnbind = async (c: Counter) => {
  busyId.value = c.id
  try {
    const res = await apiPost<{ message: string; counter: Counter }>(`/admin/counters/${c.id}/force-unbind`)
    const idx = counters.value.findIndex((x) => x.id === c.id)
    if (idx !== -1) {
      counters.value[idx] = { ...counters.value[idx], currentStaffId: null, currentStaff: null }
    }
    showToast(`${c.currentStaff?.fullName || 'Staff'} unbound from ${c.counterName}`)
  } catch (err: any) {
    showToast(err?.message || 'Failed to unbind staff')
  } finally {
    busyId.value = null
  }
}

const copyId = async (c: Counter) => {
  try {
    await navigator.clipboard.writeText(c.id)
    copiedId.value = c.id
    showToast('Counter ID copied')
    setTimeout(() => (copiedId.value = null), 1500)
  } catch {
    showToast('Unable to copy')
  }
}

const lockScroll = (locked: boolean) => {
  if (import.meta.client) document.body.style.overflow = locked ? 'hidden' : ''
}

watch(showForm, (open) => lockScroll(open))
onUnmounted(() => lockScroll(false))
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-extrabold tracking-tight text-foreground">Counters</h2>
      </div>
      <button class="btn btn-sm btn-primary" @click="openForm">
        <Plus class="h-4 w-4" />
        Add Counter
      </button>
    </div>

    <!-- Add counter modal -->
    <Teleport to="body">
      <div
        v-if="showForm"
        class="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-[2px]"
        @click.self="openForm"
      >
        <div class="relative flex min-h-full items-center justify-center p-4 sm:p-6">
          <div class="card relative my-auto w-full max-w-md p-6 shadow-pop">
            <div class="relative mb-5 text-center">
              <button class="absolute right-0 top-0 cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" @click="openForm">
                <X class="h-4 w-4" />
              </button>
              <h3 class="text-base font-bold text-foreground">New Counter</h3>
              <p class="mt-0.5 text-xs text-muted-foreground">Add a new counter to the branch.</p>
            </div>

            <div class="space-y-4">
              <div class="space-y-1.5">
                <label class="label" for="counter-number">Counter Number</label>
                <input
                  id="counter-number"
                  v-model.number="newNumber"
                  type="number"
                  min="1"
                  max="999"
                  step="1"
                  class="input"
                  :class="touched.number && formErrors.number ? 'border-danger' : ''"
                  placeholder="e.g. 5"
                  @blur="validateField('number')"
                  @input="touched.number && validateField('number')"
                />
                <p v-if="touched.number && formErrors.number" class="text-xs text-danger">{{ formErrors.number }}</p>
              </div>
              <div class="space-y-1.5">
                <label class="label" for="counter-name">Counter Name</label>
                <input
                  id="counter-name"
                  v-model="newName"
                  class="input"
                  :class="touched.name && formErrors.name ? 'border-danger' : ''"
                  placeholder="e.g. VIP / Priority Desk"
                  @blur="validateField('name')"
                  @input="touched.name && validateField('name')"
                  @keydown.enter="handleCreate"
                />
                <p v-if="touched.name && formErrors.name" class="text-xs text-danger">{{ formErrors.name }}</p>
              </div>
            </div>

            <div class="mt-6 flex gap-3">
              <button :disabled="creating" class="btn btn-md btn-primary flex-1" @click="handleCreate">
                <Loader2 v-if="creating" class="h-4 w-4 animate-spin" />
                Create
              </button>
              <button class="btn btn-md btn-outline flex-1" @click="openForm">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <p v-if="errorMsg" class="text-xs text-danger">{{ errorMsg }}</p>

    <div class="card overflow-hidden">
      <div v-if="loading" class="space-y-5">
        <div class="flex items-center justify-between border-b border-border bg-white/40 px-5 py-4 dark:bg-white/5">
          <Skeleton class="h-4 w-16" />
          <Skeleton class="h-4 w-24" />
        </div>
        <div class="divide-y divide-border">
          <div v-for="r in 4" :key="r" class="flex items-center gap-3 px-5 py-3.5">
            <Skeleton class="h-4 w-10 flex-shrink-0" />
            <div class="min-w-0 flex-1 space-y-1.5">
              <Skeleton class="h-3.5 w-2/3" />
              <Skeleton class="h-3 w-1/3" />
            </div>
            <Skeleton class="h-5 w-20 flex-shrink-0 rounded-full" />
            <Skeleton class="h-5 w-10 flex-shrink-0 rounded-full" />
          </div>
        </div>
      </div>
      <div v-else-if="counters.length === 0" class="px-5 py-16 text-center text-sm text-muted-foreground">
        No counters configured yet.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="table-gmail w-full text-sm">
          <thead class="bg-muted/40">
            <tr class="border-b border-border">
              <th class="th">Counter</th>
              <th class="th">Status</th>
              <th class="th hidden md:table-cell">Staff</th>
              <th class="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="c in paginated" :key="c.id">
              <td class="td">
                <div class="flex items-center gap-3">
                  <span class="text-sm font-bold text-foreground tabular-nums">
                    {{ String(c.counterNumber).padStart(2, '0') }}
                  </span>
                  <div class="min-w-0">
                    <p class="truncate font-semibold text-foreground">{{ c.counterName }}</p>
                    <button class="inline-flex cursor-pointer items-center gap-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-gray-900" @click="copyId(c)">
                      <component :is="copiedId === c.id ? Check : Copy" class="h-3 w-3" />
                      {{ copiedId === c.id ? 'Copied!' : c.id }}
                    </button>
                  </div>
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
                <span v-if="c.currentStaff">
                  {{ c.currentStaff.employeeId }}
                </span>
                <span v-else>Unassigned</span>
              </td>
              <td class="td text-right">
                <div class="flex items-center justify-end gap-3">
                  <button
                    v-if="c.currentStaff"
                    :disabled="busyId === c.id"
                    class="btn btn-sm btn-ghost-danger"
                    @click="handleForceUnbind(c)"
                  >
                    <Loader2 v-if="busyId === c.id" class="h-3.5 w-3.5 animate-spin" />
                    <Unlink v-else class="h-3.5 w-3.5" />
                    Unbind
                  </button>
                  <button
                    role="switch"
                    :aria-checked="c.isActive"
                    :disabled="busyId === c.id"
                    @click="handleToggle(c)"
                    :class="[
                      'relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                      c.isActive ? 'bg-gray-900' : 'bg-border',
                    ]"
                  >
                    <span
                      :class="[
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200',
                        c.isActive ? 'translate-x-[22px]' : 'translate-x-0.5',
                      ]"
                    />
                  </button>
                </div>
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
          Showing {{ (page - 1) * PER + 1 }}–{{ Math.min(page * PER, counters.length) }} of {{ counters.length }}
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