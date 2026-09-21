<script setup lang="ts">
import { statusLabel } from '~/utils/format'

const props = defineProps<{ status: string }>()

const styles: Record<string, { pill: string; dot: string }> = {
  WAITING: { pill: 'bg-primary-light text-primary-dark-text', dot: 'bg-primary' },
  CALLED: { pill: 'bg-primary text-white', dot: 'bg-white' },
  IN_SERVICE: { pill: 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900', dot: 'bg-white dark:bg-slate-900' },
  SERVED: { pill: 'bg-success-light text-success', dot: 'bg-success' },
  SKIPPED: { pill: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  CANCELLED: { pill: 'bg-danger-light text-danger', dot: 'bg-danger' },
  AUTO_CANCELLED: { pill: 'bg-danger-light text-danger', dot: 'bg-danger' },
  // Legacy / display labels
  'Waiting': { pill: 'bg-primary-light text-primary-dark-text', dot: 'bg-primary' },
  'Near Turn': { pill: 'bg-primary text-white', dot: 'bg-white' },
  'Now Serving': { pill: 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900', dot: 'bg-white dark:bg-slate-900' },
  'Skipped': { pill: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  'Served': { pill: 'bg-success-light text-success', dot: 'bg-success' },
}

const current = computed(() => styles[props.status] || styles.SKIPPED)
const label = computed(() => statusLabel(props.status))
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ring-black/5 dark:ring-white/10',
      current.pill,
    ]"
  >
    <span :class="['h-1.5 w-1.5 rounded-full', current.dot]" aria-hidden="true" />
    {{ label }}
  </span>
</template>
