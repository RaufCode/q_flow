<script setup lang="ts">
import { AlertTriangle, Home, RotateCcw } from 'lucide-vue-next'

const props = defineProps<{ error: any }>()

const statusCode = computed(() => props.error?.statusCode ?? 0)
const is404 = computed(() => statusCode.value === 404)

const title = computed(() => {
  if (is404.value) return 'Page not found'
  if (statusCode.value === 500) return 'Something went wrong'
  return 'Something went wrong'
})

const description = computed(() => {
  if (is404.value) return 'The page you are looking for does not exist or has been moved.'
  return 'An unexpected error occurred. Please try again.'
})

useHead({
  title: is404.value ? 'Page not found' : 'Error',
})

const goBack = () => {
  if (import.meta.client && window.history.length > 1) {
    window.history.back()
  } else {
    navigateTo('/')
  }
}

const goHome = () => {
  clearError({ redirect: '/' })
}

const { init } = useTheme()
onMounted(init)
</script>

<template>
  <div class="min-h-screen bg-bg-customer flex items-center justify-center px-4 py-10">
    <div class="w-full max-w-md">
      <div class="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div class="px-8 pt-10 pb-7 text-center border-b border-border">
          <QFlowLogo size="lg" />
          <div class="mt-6 text-6xl font-extrabold tracking-tight text-foreground tabular-nums">
            {{ statusCode || '404' }}
          </div>
        </div>

        <div class="px-8 py-8 text-center">
          <div class="mx-auto inline-flex items-center gap-2 rounded-full bg-danger-light border border-danger-light-border px-3 py-1">
            <AlertTriangle class="w-3.5 h-3.5 text-danger" />
            <span class="text-xs font-bold text-danger uppercase tracking-wider">Error</span>
          </div>

          <h1 class="mt-5 text-2xl font-extrabold text-foreground">{{ title }}</h1>
          <p class="mx-auto mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">{{ description }}</p>

          <div class="mt-8 space-y-2.5">
            <button class="btn btn-md btn-primary w-full justify-center" @click="goHome">
              <Home class="w-4 h-4" />
              Back to Home
            </button>
            <button class="btn btn-md btn-outline w-full justify-center" @click="goBack">
              <RotateCcw class="w-4 h-4" />
              Go Back
            </button>
          </div>

          <p v-if="error?.url && !is404" class="mt-6 text-xs text-muted-foreground break-all">
            {{ error.url }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>