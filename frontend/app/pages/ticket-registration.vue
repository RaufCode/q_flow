<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { apiPost } from '~/utils/api'
import { isValidName, isValidPhone, nameMessage, phoneMessage, trim } from '~/utils/validate'

definePageMeta({ layout: 'customer' })

const route = useRoute()
const siteName = computed(() => {
  const site = route.query.site
  return typeof site === 'string' && site.trim() ? site.trim() : 'KFC'
})

const name = ref('')
const phone = ref('')
const errors = ref<{ name?: string; phone?: string }>({})
const touched = ref<{ name?: boolean; phone?: boolean }>({})
const loading = ref(false)
const serverError = ref('')

const validate = () => {
  const errs: typeof errors.value = {}
  const n = trim(name.value)
  if (!n) errs.name = 'Please enter your full name.'
  else if (!isValidName(n)) errs.name = nameMessage(n)
  const p = trim(phone.value)
  if (!p) errs.phone = 'Please enter your phone number.'
  else if (!isValidPhone(p)) errs.phone = phoneMessage(p)
  errors.value = errs
  return Object.keys(errs).length === 0
}

const validateField = (field: 'name' | 'phone') => {
  touched.value[field] = true
  validate()
}

const handleSubmit = async () => {
  serverError.value = ''
  touched.value = { name: true, phone: true }
  if (!validate()) return

  loading.value = true
  try {
    const res = await apiPost<{ message: string; ticket: any }>('/tickets/check-in', {
      customerName: trim(name.value),
      phoneNumber: trim(phone.value),
      preferredChannel: 'SMS',
    })

    const ticket = res.ticket
    if (import.meta.client && ticket?.id) {
      localStorage.setItem('qflow_current_ticket', ticket.id)
      localStorage.setItem(`qflow_ticket_${ticket.id}`, JSON.stringify(ticket))
    }
    navigateTo(`/ticket/${ticket.id}`)
  } catch (err: any) {
    serverError.value = err?.message || 'We could not add you to the queue. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <QFlowLogo />
      <div class="flex items-center gap-3">
        <span class="text-xs text-muted-foreground tabular-nums hidden sm:inline">Live Queue</span>
      </div>
    </div>

    <div class="flex items-center gap-2 mb-4">
      <div class="w-5 h-5 rounded-full bg-success-light flex items-center justify-center flex-shrink-0">
        <svg class="w-3 h-3 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <span class="text-xs font-bold text-success">QR Code Scanned Successfully</span>
    </div>

    <div class="bg-bg-page border border-border rounded-xl p-4 mb-6">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </div>
        <div class="min-w-0">
          <p class="text-xs text-muted-foreground font-medium">You are joining</p>
          <p class="text-sm font-bold text-foreground">{{ siteName }}</p>
          <p class="text-xs font-semibold text-primary mt-0.5">Account Services</p>
        </div>
      </div>
    </div>

    <div class="mb-5">
      <h1 class="text-xl font-bold text-foreground">Enter Your Details</h1>
      <p class="text-sm text-muted-foreground mt-1">We'll text you when it's almost your turn.</p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="space-y-1.5">
        <label class="block text-sm font-semibold text-foreground">Full Name</label>
        <input
          v-model="name"
          autocomplete="name"
          :class="['w-full px-3 py-2.5 rounded-md border bg-input-bg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm', errors.name ? 'border-danger' : 'border-border']"
          placeholder="Your full name"
          @blur="validateField('name')"
          @input="touched.name && validateField('name')"
        />
        <p v-if="errors.name" class="text-xs text-danger mt-1">{{ errors.name }}</p>
      </div>

      <div class="space-y-1.5">
        <label class="block text-sm font-semibold text-foreground">Phone Number</label>
        <input
          v-model="phone"
          type="tel"
          autocomplete="tel"
          :class="['w-full px-3 py-2.5 rounded-md border bg-input-bg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm', errors.phone ? 'border-danger' : 'border-border']"
          placeholder="+233 20 0000 000"
          @blur="validateField('phone')"
          @input="touched.phone && validateField('phone')"
        />
        <p v-if="errors.phone" class="text-xs text-danger mt-1">{{ errors.phone }}</p>
      </div>

      <div v-if="serverError" class="flex items-start gap-2.5 p-3 bg-danger-light border border-danger-light-border rounded-md">
        <svg class="w-4 h-4 text-danger flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <p class="text-sm text-danger">{{ serverError }}</p>
      </div>

      <button
        type="submit"
        :disabled="loading"
        class="w-full inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed select-none bg-primary text-white hover:bg-primary-hover active:bg-primary-active px-5 py-3 text-base mt-1 cursor-pointer"
      >
        <Loader2 v-if="loading" class="w-4 h-4 animate-spin" />
        {{ loading ? 'Joining…' : 'Join Queue' }}
        <svg v-if="!loading" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
    </form>
  </div>
</template>