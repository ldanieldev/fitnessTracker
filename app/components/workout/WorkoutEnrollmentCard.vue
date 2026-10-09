<script setup lang="ts">
import type { Enrollment } from '~~/shared/types/program'
import WorkoutPhaseBar from '~/components/workout/WorkoutPhaseBar.vue'
import { enrollmentBadge, enrollmentLine } from '~/utils/enrollmentLine'

const props = defineProps<{ enrollment: Enrollment }>()
const emit = defineEmits<{ pause: []; resume: []; end: []; dismiss: [] }>()

const weeksDone = computed(() =>
  props.enrollment.state === 'finished' ? props.enrollment.totalWeeks : props.enrollment.week - 1
)
const badge = computed(() => enrollmentBadge(props.enrollment))
const live = computed(() => props.enrollment.state !== 'finished')
</script>

<template>
  <div class="flex flex-col gap-3 rounded-xl border border-default bg-elevated p-3" data-test="enrollment-card">
    <div class="flex items-start gap-2">
      <NuxtLink
        :to="`/workouts/programs/${enrollment.program.id}`"
        class="flex min-h-10 min-w-0 flex-1 flex-col justify-center"
      >
        <span class="truncate font-semibold text-highlighted" data-test="enrollment-program">{{
          enrollment.program.name
        }}</span>
        <span class="flex items-center gap-2 text-sm text-muted">
          <span class="truncate" data-test="enrollment-line">{{ enrollmentLine(enrollment) }}</span>
          <UBadge
            v-if="badge"
            :label="badge"
            size="sm"
            variant="subtle"
            :color="badge === 'Deload' ? 'warning' : 'neutral'"
            data-test="enrollment-badge"
          />
        </span>
      </NuxtLink>
      <template v-if="live">
        <UButton
          v-if="enrollment.state === 'paused'"
          icon="i-lucide-play"
          variant="ghost"
          color="neutral"
          class="size-10 justify-center"
          aria-label="Resume program"
          data-test="enrollment-resume"
          @click="emit('resume')"
        />
        <UButton
          v-else
          icon="i-lucide-pause"
          variant="ghost"
          color="neutral"
          class="size-10 justify-center"
          aria-label="Pause program"
          data-test="enrollment-pause"
          @click="emit('pause')"
        />
        <UButton
          icon="i-lucide-square"
          variant="ghost"
          color="neutral"
          class="size-10 justify-center"
          aria-label="End program"
          data-test="enrollment-end"
          @click="emit('end')"
        />
      </template>
      <UButton
        v-else
        icon="i-lucide-x"
        variant="ghost"
        color="neutral"
        class="size-10 justify-center"
        aria-label="Dismiss"
        data-test="enrollment-dismiss"
        @click="emit('dismiss')"
      />
    </div>
    <WorkoutPhaseBar :phases="enrollment.phases" :weeks-done="weeksDone" />
  </div>
</template>
