<script setup lang="ts">
import type { ProgramPhase } from '~~/shared/types/program'
import { phaseColorClass } from '~~/shared/utils/programs'

const props = defineProps<{ phases: ProgramPhase[]; weeksDone: number }>()

const segments = computed(() => {
  let start = 0
  return props.phases.map((phase, index) => {
    const fill = Math.min(Math.max((props.weeksDone - start) / phase.weeks, 0), 1)
    start += phase.weeks
    return { id: phase.id, weeks: phase.weeks, fill, color: phaseColorClass(index) }
  })
})
</script>

<template>
  <div class="flex h-2 gap-0.5" aria-hidden="true">
    <div
      v-for="segment in segments"
      :key="segment.id"
      class="relative overflow-hidden rounded-full bg-accented"
      :style="{ flexGrow: segment.weeks, flexBasis: 0 }"
      data-test="enrollment-segment"
    >
      <div class="absolute inset-y-0 left-0" :class="segment.color" :style="{ width: `${segment.fill * 100}%` }" />
    </div>
  </div>
</template>
