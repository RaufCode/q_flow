<script setup lang="ts">
import { Sun, Moon } from 'lucide-vue-next'

const { theme, toggle } = useTheme()
const isDark = computed(() => theme.value === 'dark')
</script>

<template>
  <button
    type="button"
    @click="toggle"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="isDark ? 'Light mode' : 'Dark mode'"
    class="relative inline-flex h-9 w-9 items-center justify-center rounded-none border border-border bg-card text-muted-foreground transition-all duration-200 hover:border-primary-border hover:bg-primary-lighter hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-page"
  >
    <Sun v-if="isDark" class="h-[18px] w-[18px]" />
    <Moon v-else class="h-[18px] w-[18px]" />
  </button>
</template>
