<script setup lang="ts">
const props = withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg'; tone?: 'default' | 'light' }>(), { size: 'md', tone: 'default' })
const sizeClass = computed(() => ({ sm: 'text-lg', md: 'text-xl', lg: 'text-2xl' }[props.size]))
</script>

<template>
  <span
    :class="['font-extrabold uppercase tracking-[0.18em] leading-none', tone === 'light' ? 'text-white' : 'text-foreground', sizeClass]"
  >
    QFLOW
  </span>
</template>