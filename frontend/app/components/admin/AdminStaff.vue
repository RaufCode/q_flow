<script setup lang="ts">
import { Loader2, Plus, KeyRound, X, Search, ShieldCheck, UserRound, Check, Copy, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { apiGet, apiPost } from '~/utils/api'
import { roleLabel, formatDate } from '~/utils/format'
import { trim, isValidName, isValidEmployeeId, passwordIssues, employeeIdMessage, nameMessage } from '~/utils/validate'

const showToast = inject<(msg: string) => void>('showToast', () => {})

interface AdminUser {
  id: string
  employeeId: string
  fullName: string
  role: 'ADMIN' | 'COUNTER_STAFF'
  createdAt: string
  activeCounter: { id: string; counterNumber: number; counterName: string; isActive: boolean } | null
}

const users = ref<AdminUser[]>([])
const loading = ref(true)
const errorMsg = ref('')
const search = ref('')
const showForm = ref(false)
const creating = ref(false)
const form = ref({
  employeeId: '',
  fullName: '',
  role: 'COUNTER_STAFF' as 'ADMIN' | 'COUNTER_STAFF',
})
const formErrors = ref({
  employeeId: '',
  fullName: '',
})
const touched = ref<Record<string, boolean>>({})

const created = ref<{ fullName: string; employeeId: string; password: string } | null>(null)
const copiedField = ref<'employeeId' | 'password' | null>(null)

const randomPassword = () => {
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const all = lower + upper + digits
  const pick = (set: string, n: number) =>
    Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join('')
  return `${pick(upper, 2)}${pick(lower, 4)}${pick(digits, 2)}${pick(all, 2)}`
}

const copy = async (text: string, field: 'employeeId' | 'password') => {
  try {
    await navigator.clipboard.writeText(text)
    copiedField.value = field
    setTimeout(() => (copiedField.value = null), 1500)
  } catch {
    showToast('Unable to copy')
  }
}

const validateForm = () => {
  const errors = { employeeId: '', fullName: '' }
  const ev = trim(form.value.employeeId)
  if (!ev) errors.employeeId = 'Employee ID is required.'
  else if (!isValidEmployeeId(ev)) errors.employeeId = employeeIdMessage(ev)
  if (!trim(form.value.fullName)) errors.fullName = 'Full name is required.'
  else if (!isValidName(form.value.fullName)) errors.fullName = nameMessage(form.value.fullName)
  formErrors.value = errors
  return !Object.values(errors).some(Boolean)
}

const validateField = (field: 'employeeId' | 'fullName') => {
  touched.value[field] = true
  validateForm()
}

const resetIssues = computed(() => (newPassword.value ? passwordIssues(newPassword.value) : []))

const createError = ref('')

const resetTarget = ref<AdminUser | null>(null)
const newPassword = ref('')
const showResetPw = ref(false)
const resetting = ref(false)

const load = async () => {
  loading.value = true
  try {
    const res = await apiGet<{ users: AdminUser[] }>('/admin/users')
    users.value = res.users || []
    errorMsg.value = ''
  } catch (err: any) {
    errorMsg.value = err?.message || 'Failed to load users.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const filtered = computed(() => {
  const s = search.value.toLowerCase()
  return users.value.filter(
    (u) =>
      !s ||
      u.fullName.toLowerCase().includes(s) ||
      u.employeeId.toLowerCase().includes(s),
  )
})

const PER = 10
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PER)))
const paginated = computed(() => filtered.value.slice((page.value - 1) * PER, page.value * PER))

watch(search, () => (page.value = 1))

const handleSubmit = async () => {
  createError.value = ''
  touched.value = { employeeId: true, fullName: true }
  if (!validateForm()) return
  creating.value = true
  const generatedPassword = randomPassword()
  try {
    const res = await apiPost<{ message: string; user: AdminUser }>('/admin/users', {
      employeeId: form.value.employeeId.trim(),
      fullName: form.value.fullName.trim(),
      password: generatedPassword,
      role: form.value.role,
    })
    users.value = [...users.value, { ...res.user, activeCounter: null }]
    created.value = {
      fullName: form.value.fullName.trim(),
      employeeId: form.value.employeeId.trim(),
      password: generatedPassword,
    }
    form.value = { employeeId: '', fullName: '', role: 'COUNTER_STAFF' }
    touched.value = {}
    formErrors.value = { employeeId: '', fullName: '' }
    createError.value = ''
  } catch (err: any) {
    createError.value = err?.message || 'Failed to create account'
    showToast(createError.value)
  } finally {
    creating.value = false
  }
}

const closeForm = () => {
  showForm.value = false
  created.value = null
}

const openForm = () => {
  showForm.value = true
  created.value = null
  form.value = { employeeId: '', fullName: '', role: 'COUNTER_STAFF' }
  formErrors.value = { employeeId: '', fullName: '' }
  touched.value = {}
  createError.value = ''
}

const openReset = (u: AdminUser) => {
  resetTarget.value = u
  newPassword.value = ''
}

const handleReset = async () => {
  if (!resetTarget.value || resetIssues.value.length > 0) return
  resetting.value = true
  try {
    await apiPost(`/admin/users/${resetTarget.value.id}/reset-password`, {
      newPassword: newPassword.value,
    })
    showToast(`Password reset for ${resetTarget.value.employeeId}`)
    resetTarget.value = null
    newPassword.value = ''
  } catch (err: any) {
    showToast(err?.message || 'Failed to reset password')
  } finally {
    resetting.value = false
  }
}

const lockScroll = (locked: boolean) => {
  if (import.meta.client) document.body.style.overflow = locked ? 'hidden' : ''
}

watch([showForm, resetTarget], ([formOpen, resetOpen]) => lockScroll(!!formOpen || !!resetOpen))
onUnmounted(() => lockScroll(false))
</script>

<template>
  <div class="space-y-5">
    <!-- Reset password modal -->
    <Teleport to="body">
      <div
        v-if="resetTarget"
        class="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-[2px]"
        @click.self="resetTarget = null"
      >
        <div class="relative flex min-h-full items-center justify-center p-4 sm:p-6">
          <div class="card relative my-auto w-full max-w-sm p-6 shadow-pop">
            <div class="relative mb-4 text-center">
              <button class="absolute right-0 top-0 cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" @click="resetTarget = null">
                <X class="h-4 w-4" />
              </button>
              <h3 class="text-base font-bold text-foreground">Reset Password</h3>
              <p class="mt-0.5 text-xs text-muted-foreground">{{ resetTarget.fullName }} · {{ resetTarget.employeeId }}</p>
            </div>
            <div class="relative">
              <input
                v-model="newPassword"
                :type="showResetPw ? 'text' : 'password'"
                autocomplete="new-password"
                class="input pr-10"
                :class="resetIssues.length > 0 && 'border-danger'"
                placeholder="New password (min 8 chars, upper + lower + number)"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                :aria-label="showResetPw ? 'Hide password' : 'Show password'"
                @click="showResetPw = !showResetPw"
              >
                <component :is="showResetPw ? EyeOff : Eye" class="h-4 w-4" />
              </button>
            </div>
            <p
              v-if="resetIssues.length > 0"
              class="mt-1 text-xs text-danger"
            >
              {{ resetIssues[0] }}
            </p>
            <div class="mt-5 flex gap-3">
              <button class="btn btn-md btn-outline flex-1" @click="resetTarget = null">Cancel</button>
              <button
                :disabled="resetIssues.length > 0 || resetting"
                class="btn btn-md btn-primary flex-1"
                @click="handleReset"
              >
                <Loader2 v-if="resetting" class="h-4 w-4 animate-spin" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-extrabold tracking-tight text-foreground">Staff</h2>
      </div>
      <button class="btn btn-sm btn-primary" @click="openForm">
        <Plus class="h-4 w-4" />
        Add Staff
      </button>
    </div>

    <!-- Create account modal -->
    <Teleport to="body">
      <div
        v-if="showForm"
        class="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-[2px]"
        @click.self="closeForm"
      >
        <div class="relative flex min-h-full items-center justify-center p-4 sm:p-6">
          <div class="card relative my-auto w-full max-w-xl p-6 shadow-pop">
          <div class="relative mb-5 text-center">
            <button class="absolute right-0 top-0 cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" @click="closeForm">
              <X class="h-4 w-4" />
            </button>
            <h3 class="text-base font-bold text-foreground">New Staff Account</h3>
            <p class="mt-0.5 text-xs text-muted-foreground">Create an account for a counter staff member or admin.</p>
          </div>

          <!-- Success screen -->
          <div v-if="created" class="space-y-5">
            <div class="flex items-start gap-3 rounded-xl border border-success-check bg-success-light p-4">
              <span class="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-success">
                <Check class="h-4 w-4 text-white" />
              </span>
              <div class="min-w-0">
                <p class="text-sm font-bold text-foreground">Account created for {{ created.fullName }}</p>
                <p class="mt-0.5 text-xs text-muted-foreground">Share the password below — they'll need it to sign in.</p>
              </div>
            </div>

            <div class="space-y-3">
              <div class="flex items-center justify-between gap-3 rounded-md border border-border bg-input-bg px-3 py-2.5">
                <div class="min-w-0">
                  <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Employee ID</p>
                  <p class="truncate font-mono text-sm font-semibold text-foreground">{{ created.employeeId }}</p>
                </div>
                <button class="btn btn-sm btn-outline flex-shrink-0" @click="copy(created && created.employeeId, 'employeeId')">
                  <component :is="copiedField === 'employeeId' ? Check : Copy" class="h-3.5 w-3.5" />
                  {{ copiedField === 'employeeId' ? 'Copied' : 'Copy' }}
                </button>
              </div>
              <div class="flex items-center justify-between gap-3 rounded-md border border-border bg-input-bg px-3 py-2.5">
                <div class="min-w-0">
                  <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Password</p>
                  <p class="truncate font-mono text-sm font-semibold text-foreground">{{ created.password }}</p>
                </div>
                <button class="btn btn-sm btn-outline flex-shrink-0" @click="copy(created && created.password, 'password')">
                  <component :is="copiedField === 'password' ? Check : Copy" class="h-3.5 w-3.5" />
                  {{ copiedField === 'password' ? 'Copied' : 'Copy' }}
                </button>
              </div>
            </div>

            <div class="flex gap-3">
              <button class="btn btn-md btn-primary flex-1" @click="closeForm">Done</button>
              <button class="btn btn-md btn-outline flex-1" @click="created = null">Add Another</button>
            </div>
          </div>

          <!-- Form -->
          <form v-else @submit.prevent="handleSubmit">
            <div class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="label" for="emp-id">Employee ID</label>
                <input id="emp-id" v-model="form.employeeId" autocomplete="off" class="input" :class="touched.employeeId && formErrors.employeeId && 'border-danger'" placeholder="e.g. STF-004" @blur="validateField('employeeId')" @input="touched.employeeId && validateField('employeeId')" />
                <p v-if="touched.employeeId && formErrors.employeeId" class="mt-1 text-xs text-danger">{{ formErrors.employeeId }}</p>
              </div>
              <div>
                <label class="label" for="full-name">Full Name</label>
                <input id="full-name" v-model="form.fullName" autocomplete="name" class="input" :class="touched.fullName && formErrors.fullName && 'border-danger'" placeholder="Enter full name" @blur="validateField('fullName')" @input="touched.fullName && validateField('fullName')" />
                <p v-if="touched.fullName && formErrors.fullName" class="mt-1 text-xs text-danger">{{ formErrors.fullName }}</p>
              </div>
              <div>
                <label class="label" for="role">Role</label>
                <select id="role" v-model="form.role" class="input">
                  <option value="COUNTER_STAFF">Counter Staff</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <p v-if="createError" class="mb-3 text-xs text-danger">{{ createError }}</p>
            <div class="flex flex-wrap justify-center gap-3">
              <button type="submit" :disabled="creating" class="btn btn-md btn-primary">
                <Loader2 v-if="creating" class="h-4 w-4 animate-spin" />
                Create Account
              </button>
              <button type="button" class="btn btn-md btn-outline" @click="closeForm">Cancel</button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </Teleport>

    <!-- Search -->
    <div class="relative sm:w-80">
      <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        v-model="search"
        class="input pl-9"
        placeholder="Search staff…"
      />
    </div>

    <p v-if="errorMsg" class="text-xs text-danger">{{ errorMsg }}</p>

    <!-- Table -->
    <div class="card overflow-hidden">
      <div v-if="loading">
        <div class="grid grid-cols-6 items-center gap-4 border-b border-border bg-muted/40 px-5 py-3.5">
          <Skeleton v-for="h in 6" :key="h" class="h-3 w-14" />
        </div>
        <div class="divide-y divide-border">
          <div v-for="r in 5" :key="r" class="grid grid-cols-6 items-center gap-4 px-5 py-3.5">
            <div class="space-y-1.5">
              <Skeleton class="h-3.5 w-28" />
              <Skeleton class="h-3 w-20" />
            </div>
            <Skeleton class="h-3.5 w-16" />
            <Skeleton class="h-5 w-24 rounded-full" />
            <Skeleton class="h-3.5 w-24" />
            <Skeleton class="h-3.5 w-24" />
            <div class="justify-self-end">
              <Skeleton class="h-6 w-16 rounded-md" />
            </div>
          </div>
        </div>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="table-gmail w-full text-sm">
          <thead class="bg-muted/40">
            <tr class="border-b border-border">
              <th class="th">Name</th>
              <th class="th">Employee ID</th>
              <th class="th">Role</th>
              <th class="th">Counter</th>
              <th class="th">Created</th>
              <th class="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="filtered.length === 0">
              <td colspan="6" class="px-5 py-14 text-center text-muted-foreground">No accounts found.</td>
            </tr>
            <tr v-for="m in paginated" :key="m.id">
              <td class="td whitespace-nowrap">
                <span class="block truncate font-semibold text-foreground">{{ m.fullName }}</span>
              </td>
              <td class="td text-muted-foreground whitespace-nowrap font-mono text-xs">{{ m.employeeId }}</td>
              <td class="td whitespace-nowrap">
                <span
                  :class="[
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ring-black/5 dark:ring-white/10',
                    m.role === 'ADMIN' ? 'bg-primary-light text-primary-dark-text' : 'bg-muted text-muted-foreground',
                  ]"
                >
                  <ShieldCheck v-if="m.role === 'ADMIN'" class="h-3 w-3" />
                  <UserRound v-else class="h-3 w-3" />
                  {{ roleLabel(m.role) }}
                </span>
              </td>
              <td class="td text-muted-foreground whitespace-nowrap">
                <span v-if="m.activeCounter">
                  {{ m.activeCounter.counterName }}
                  <span class="font-bold text-foreground tabular-nums">#{{ m.activeCounter.counterNumber }}</span>
                </span>
                <span v-else>Unassigned</span>
              </td>
              <td class="td text-muted-foreground whitespace-nowrap tabular-nums">{{ formatDate(m.createdAt) }}</td>
              <td class="td text-right whitespace-nowrap">
                <button
                  class="inline-flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-gray-900"
                  title="Reset password"
                  @click="openReset(m)"
                >
                  <KeyRound class="h-3.5 w-3.5" />
                  Reset
                </button>
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