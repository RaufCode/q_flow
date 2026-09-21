<script setup lang="ts">
defineProps<{ message: string; visible: boolean }>()
</script>

<template>
  <div
    :class="[
      'fixed top-5 right-5 z-[100] flex max-w-sm items-center gap-2.5 rounded-xl border border-border bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-pop pointer-events-none transition-all duration-300',
      visible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
    ]"
  >
    <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-success-light">
      <svg class="h-3.5 w-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
    {{ message }}
  </div>
</template>