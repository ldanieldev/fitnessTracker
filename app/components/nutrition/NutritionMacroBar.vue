<script setup lang="ts">
withDefaults(defineProps<{ label: string, figure: string, progress: number | null, color?: 'primary' | 'error' | 'protein' | 'carb' | 'fat' | 'neutral', labelClass?: string, dataTest?: string }>(), { color: 'neutral', labelClass: '', dataTest: undefined })
const BG: Record<string, string> = { primary: 'bg-primary', error: 'bg-error', protein: 'bg-protein', carb: 'bg-carb', fat: 'bg-fat', neutral: 'bg-macro-other' }
</script>

<template>
  <div class="flex flex-col gap-1" :data-test="dataTest">
    <div class="flex items-baseline justify-between text-xs">
      <span :class="labelClass">{{ label }}</span>
      <span class="font-semibold tabular-nums text-highlighted">{{ figure }}</span>
    </div>
    <div class="h-1.5 overflow-hidden rounded-full bg-accented">
      <div v-if="progress !== null" class="h-full rounded-full" :class="BG[color]" :style="{ width: `${Math.min(progress, 100)}%` }" />
    </div>
  </div>
</template>
