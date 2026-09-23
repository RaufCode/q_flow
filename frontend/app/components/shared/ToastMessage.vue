<script setup lang="ts">
import type { ToastTone } from '~/composables/useToast'

const props = defineProps<{ message: string; visible: boolean; tone?: ToastTone }>()

const tones: Record<ToastTone, { panel: string; chip: string; icon: string }> = {
  success: { panel: '', chip: 'bg-success-light', icon: 'text-success' },
  error: { panel: 'border-danger-border', chip: 'bg-danger-light', icon: 'text-danger' },
  info: { panel: 'border-primary-border', chip: 'bg-primary-light', icon: 'text-primary-dark-text dark:text-primary' },
}

const style = computed(() => tones[props.tone || 'info'])
</script>

<template>
  <div
    :class="[
      'fixed top-5 right-5 z-[100] flex max-w-sm items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-pop pointer-events-none transition-all duration-300',
      style.panel,
      visible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0',
    ]"
  >
    <span :class="['flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full', style.chip]">
      <svg
        v-if="tone === 'error'"
        class="h-3.5 w-3.5"
        :class="style.icon"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
      <svg
        v-else
        class="h-3.5 w-3.5"
        :class="style.icon"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path v-if="tone === 'success'" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        <path v-else stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </span>
    <span class="min-w-0">{{ message }}</span>
  </div>
</template>