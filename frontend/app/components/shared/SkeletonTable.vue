<script setup lang="ts">
const props = withDefaults(defineProps<{ rows?: number; cols?: number }>(), { rows: 6, cols: 5 })

const WIDTHS = ['w-24', 'w-16', 'w-20', 'w-14', 'w-16', 'w-24', 'w-20']
const cellClass = (c: number, r: number) => WIDTHS[(c + r) % WIDTHS.length]
const gridStyle = (cols: number) => ({ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` })
</script>

<template>
  <div>
    <div
      class="border-b border-border bg-muted/40 grid items-center gap-6 px-5 py-3.5"
      :style="gridStyle(cols)"
    >
      <Skeleton v-for="h in cols" :key="'h-' + h" class="h-3" :class="cellClass(h - 1, 0)" />
    </div>
    <div class="divide-y divide-border">
      <div v-for="r in rows" :key="r" class="grid items-center gap-6 px-5 py-4" :style="gridStyle(cols)">
        <Skeleton v-for="c in cols" :key="r + '-' + c" class="h-4" :class="cellClass(c - 1, r)" />
      </div>
    </div>
  </div>
</template>