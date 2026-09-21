<script setup lang="ts">
import type { Component } from 'vue'

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    sub?: string
    icon?: Component
    tone?: Tone
    trend?: string
    trendUp?: boolean
    progress?: number
    spark?: number[]
  }>(),
  { tone: 'primary', trendUp: true, progress: -1, spark: undefined },
)

const tones: Record<Tone, { chip: string; bar: string; text: string }> = {
  primary: { chip: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground', text: 'text-muted-foreground' },
  success: { chip: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground', text: 'text-muted-foreground' },
  warning: { chip: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground', text: 'text-muted-foreground' },
  danger: { chip: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground', text: 'text-muted-foreground' },
  neutral: { chip: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground', text: 'text-muted-foreground' },
}

const style = computed(() => tones[props.tone])
const clampedProgress = computed(() => Math.min(100, Math.max(0, props.progress)))

const sparkPath = computed(() => {
  const pts = props.spark
  if (!pts || pts.length < 2) return ''
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  const w = 100
  const h = 28
  return pts
    .map((p, i) => {
      const x = (i / (pts!.length - 1)) * w
      const y = h - ((p - min) / range) * (h - 4) - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})
</script>

<template>
  <div
    class="card card-hover group relative overflow-hidden p-5"
  >
    <!-- soft tonal wash -->
    <span
      :class="['pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-60', style.chip]"
      aria-hidden="true"
    />

    <div class="relative flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-bold uppercase tracking-wider text-muted-foreground">{{ label }}</p>
        <p class="mt-2 text-[32px] font-extrabold leading-none tracking-tight text-foreground tabular-nums">
          {{ value }}
        </p>
      </div>

      <div class="flex flex-col items-end gap-2">
        <span
          v-if="icon"
          :class="[
            'grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-105',
            style.chip,
          ]"
        >
          <component :is="icon" class="h-5 w-5" />
        </span>
        <svg
          v-if="sparkPath"
          class="h-7 w-24 text-muted-foreground"
          viewBox="0 0 100 28"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path :d="sparkPath" :class="style.text" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.65" />
        </svg>
      </div>
    </div>

    <div v-if="sub || trend" class="relative mt-3 flex items-center gap-2">
      <span
        v-if="trend"
        :class="[
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
          trendUp ? 'bg-success-light text-success' : 'bg-danger-light text-danger',
        ]"
      >
        <svg
          class="h-3 w-3"
          :class="trendUp ? '' : 'rotate-180'"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="3"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
        </svg>
        {{ trend }}
      </span>
      <span v-if="sub" class="truncate text-xs text-muted-foreground">{{ sub }}</span>
    </div>

    <div
      v-if="progress >= 0"
      class="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      :aria-valuenow="clampedProgress"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span
        :class="['block h-full rounded-full transition-all duration-700 ease-out', style.bar]"
        :style="{ width: `${clampedProgress}%` }"
      />
    </div>
  </div>
</template>