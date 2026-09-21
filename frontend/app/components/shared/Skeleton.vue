<script setup lang="ts">
defineProps<{ class?: string }>()
</script>

<template>
  <div class="animate-pulse rounded-md bg-muted/70" :class="class" />
</template>