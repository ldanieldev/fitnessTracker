<script setup lang="ts">
import WorkoutPhaseBar from '~/components/workout/WorkoutPhaseBar.vue'
import { enrollmentBadge, enrollmentLine } from '~/utils/enrollmentLine'

const { enrollment } = useEnrollment()
const shown = computed(() => (enrollment.value && enrollment.value.state !== 'finished' ? enrollment.value : null))
const badge = computed(() => (shown.value ? enrollmentBadge(shown.value) : null))
</script>

<template>
  <NuxtLink v-if="shown" to="/workouts/log" class="flex flex-col gap-2 rounded-xl border border-default bg-elevated p-3" data-test="dashboard-program">
    <span class="flex items-center gap-2">
      <span class="truncate font-semibold text-highlighted">{{ shown.program.name }}</span>
      <UBadge v-if="badge" :label="badge" size="sm" variant="subtle" :color="badge === 'Deload' ? 'warning' : 'neutral'" />
    </span>
    <span class="truncate text-sm text-muted">{{ enrollmentLine(shown) }}</span>
    <WorkoutPhaseBar :phases="shown.phases" :weeks-done="shown.week - 1" />
    <span v-if="shown.nextDay" class="text-sm" data-test="dashboard-program-next">Next: {{ shown.nextDay.name }}</span>
  </NuxtLink>
</template>
