<script setup lang="ts">
import { Eye, EyeOff, IdCard, Lock } from 'lucide-vue-next'
import { trim, isValidEmployeeId, employeeIdMessage } from '~/utils/validate'

definePageMeta({ layout: false })

const { init } = useTheme()
onMounted(init)

const employeeId = ref('')
const pw = ref('')
const showPw = ref(false)
const err = ref('')
const loading = ref(false)
const fieldErrors = ref<{ employeeId?: string; pw?: string }>({})
const touched = ref<{ employeeId?: boolean; pw?: boolean }>({})

const validateEmployeeId = () => {
  const v = trim(employeeId.value)
  if (!v) return 'Employee ID is required.'
  return isValidEmployeeId(v) ? '' : employeeIdMessage(v)
}

const validateField = (field: 'employeeId' | 'pw') => {
  touched.value[field] = true
  if (field === 'employeeId') {
    fieldErrors.value.employeeId = validateEmployeeId() || undefined
  } else {
    fieldErrors.value.pw = !trim(pw.value) ? 'Password is required.' : undefined
  }
}

const handleSubmit = async () => {
  const errors: typeof fieldErrors.value = {}
  const employeeIdErr = validateEmployeeId()
  if (employeeIdErr) errors.employeeId = employeeIdErr
  if (!trim(pw.value)) errors.pw = 'Password is required.'
  fieldErrors.value = errors
  touched.value = { employeeId: true, pw: true }
  if (Object.keys(errors).length) return
  err.value = ''
  loading.value = true
  try {
    const { login } = useAuth()
    const res = await login(trim(employeeId.value), pw.value)
    if (res.user.role === 'ADMIN') {
      navigateTo('/admin')
    } else {
      navigateTo(res.user.activeCounter ? '/staff' : '/staff/counter')
    }
  } catch (e: any) {
    err.value = e?.message || 'Sign in failed. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg-customer flex flex-col items-center justify-center p-4">
    <div class="w-full max-w-sm mx-auto">
      <div class="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div class="gradient-brand bg-grid px-8 pt-8 pb-6 text-center">
          <QFlowLogo size="lg" tone="muted" />
        </div>

        <div class="px-8 pb-8 pt-4">
          <div class="text-center">
            <h2 class="text-xl font-bold text-foreground">Sign In</h2>
            <p class="text-sm text-muted-foreground mt-1">Sign in to access Q-Flow</p>
          </div>

          <form @submit.prevent="handleSubmit" class="mt-5 space-y-4">
            <div class="space-y-1.5">
              <label class="block text-sm font-semibold text-foreground">ID</label>
              <div class="relative">
                <IdCard class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  v-model="employeeId"
                  type="text"
                  autocomplete="username"
                  placeholder="Enter ID"
                  :class="['w-full rounded-lg border bg-input-bg py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent', fieldErrors.employeeId ? 'border-danger' : 'border-border']"
                  @blur="validateField('employeeId')"
                  @input="touched.employeeId && validateField('employeeId')"
                />
              </div>
              <p v-if="fieldErrors.employeeId" class="text-xs text-danger mt-1">{{ fieldErrors.employeeId }}</p>
            </div>

            <div class="space-y-1.5">
              <label class="block text-sm font-semibold text-foreground">Password</label>
              <div class="relative">
                <Lock class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  v-model="pw"
                  :type="showPw ? 'text' : 'password'"
                  autocomplete="current-password"
                  :class="['w-full rounded-lg border bg-input-bg py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent', fieldErrors.pw ? 'border-danger' : 'border-border']"
                  placeholder="Enter your password"
                  @blur="validateField('pw')"
                  @input="touched.pw && validateField('pw')"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  :aria-label="showPw ? 'Hide password' : 'Show password'"
                  @click="showPw = !showPw"
                >
                  <component :is="showPw ? EyeOff : Eye" class="h-4 w-4" />
                </button>
              </div>
              <p v-if="fieldErrors.pw" class="text-xs text-danger mt-1">{{ fieldErrors.pw }}</p>
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-white transition-all duration-150 select-none hover:bg-primary-hover active:bg-primary-active focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ loading ? 'Signing in…' : 'Sign In' }}
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <p v-if="err" class="text-center text-xs font-medium text-danger">{{ err }}</p>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>