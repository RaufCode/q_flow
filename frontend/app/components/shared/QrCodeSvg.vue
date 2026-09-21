<script setup lang="ts">
const props = withDefaults(defineProps<{ seed: string; size?: number }>(), { size: 180 })
const cellSize = computed(() => props.size / 21)

const cells = computed(() => {
  let h = 0
  for (let i = 0; i < props.seed.length; i++) { h = ((h << 5) - h) + props.seed.charCodeAt(i); h |= 0 }
  const s = 21
  const g: number[][] = Array(s).fill(null).map(() => Array(s).fill(0))
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const v = (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) ? 1 : 0
      g[i][j] = v; g[i][s - 1 - j] = v; g[s - 1 - i][j] = v
    }
  }
  for (let i = 8; i < s - 8; i++) { g[6][i] = i % 2 === 0 ? 1 : 0; g[i][6] = i % 2 === 0 ? 1 : 0 }
  let rng = Math.abs(h)
  for (let i = 8; i < s; i++) for (let j = 8; j < s; j++) {
    if (!g[i][j]) { rng = (rng * 1664525 + 1013904223) & 0x7fffffff; g[i][j] = (rng >> 8) & 1 }
  }
  const out: { key: string; x: number; y: number }[] = []
  const m = props.size / s
  for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) {
    if (g[i][j]) out.push({ key: `${i}-${j}`, x: j * m, y: i * m })
  }
  return out
})
</script>

<template>
  <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" style="image-rendering: pixelated; display: block">
    <rect :width="size" :height="size" fill="white" />
    <rect
      v-for="cell in cells"
      :key="cell.key"
      :x="cell.x"
      :y="cell.y"
      :width="cellSize"
      :height="cellSize"
      :fill="'var(--color-foreground)'"
    />
  </svg>
</template>