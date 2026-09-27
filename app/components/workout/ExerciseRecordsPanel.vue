<script setup lang="ts">
import { format } from 'date-fns'
import type { ExerciseRecords, GraphMetric, LoadStyle, RecordKind, TrackingType } from '~~/shared/types/workout'
import { metricLabel, metricUnit, metricsFor } from '~~/shared/utils/workoutMetrics'
import { measuresFor } from '~~/shared/utils/setRules'

const props = defineProps<{ exerciseId: number, trackingType: TrackingType, loadStyle: LoadStyle | null }>()

const { data: records } = useWorkoutFetch<ExerciseRecords>(
  () => WORKOUT_KEYS.records(props.exerciseId),
  () => `/api/workouts/exercises/${props.exerciseId}/records`
)

const noRecords = computed(() => records.value?.highlights.every((h) => h.value == null) ?? false)
const unit = computed(() => metricUnit('max_weight'))

const WEIGHT_METRICS: GraphMetric[] = ['max_weight', 'e1rm', 'volume', 'weight_at_reps']
const hasWeightMetric = computed(() => (
  metricsFor(props.trackingType, props.loadStyle).some((m) => WEIGHT_METRICS.includes(m))
))

const MEASURE_WORD: Record<string, string> = { weight: 'weight', reps: 'reps', distance: 'distance', duration: 'time' }
const noWeightMessage = computed(() => {
  const words = measuresFor(props.trackingType).map((m) => MEASURE_WORD[m])
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
  return `Records track weight and reps. This exercise logs ${list}.`
})

function highlightTitle(kind: RecordKind): string {
  if (kind === 'set_volume') return 'Best set volume'
  if (kind === 'session_volume') return 'Best session volume'
  return metricLabel(kind, props.loadStyle)
}

function recordDate(performedOn: string) {
  return format(new Date(`${performedOn}T00:00:00`), 'd MMM yyyy')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="!records" class="flex flex-col gap-3" data-test="records-skeleton" aria-busy="true">
      <div class="grid grid-cols-2 gap-2">
        <USkeleton v-for="i in 4" :key="i" class="h-24 rounded-xl" />
      </div>
      <USkeleton class="h-64 rounded-xl" />
    </div>
    <template v-else>
      <p v-if="!hasWeightMetric" class="text-sm text-dimmed" data-test="records-no-weight">{{ noWeightMessage }}</p>
      <p v-else-if="noRecords" class="text-sm text-dimmed">No records yet — log a set to start one.</p>
      <template v-else>
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="highlight in records.highlights"
            :key="highlight.kind"
            class="flex flex-col gap-1 rounded-xl bg-elevated px-3 py-2"
            data-test="record-card"
          >
            <span class="text-xs font-medium text-dimmed">{{ highlightTitle(highlight.kind) }}</span>
            <span class="text-lg font-semibold text-highlighted">
              <template v-if="highlight.value == null">—</template>
              <template v-else>
                {{ highlight.value }} {{ unit }}<template v-if="highlight.kind === 'max_weight' && highlight.reps != null">
                  &times; {{ highlight.reps }}</template>
              </template>
            </span>
            <NuxtLink
              v-if="highlight.performedOn && highlight.sessionId"
              :to="`/workouts/sessions/${highlight.sessionId}`"
              class="text-xs text-dimmed underline"
            >
              {{ recordDate(highlight.performedOn) }}
            </NuxtLink>
          </div>
        </div>

        <table class="w-full text-sm">
          <caption class="pb-2 text-left text-xs text-dimmed">
            Estimates use sets up to {{ records.repCap }} reps
          </caption>
          <thead>
            <tr class="text-left text-xs text-dimmed">
              <th class="py-1 font-medium">Reps</th>
              <th class="py-1 font-medium">Weight</th>
              <th class="hidden py-1 font-medium sm:table-cell">Date</th>
              <th class="py-1 font-medium">Est. 1RM</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in records.repMax" :key="row.reps" data-test="rep-max-row">
              <td class="py-1">{{ row.reps }}</td>
              <td class="py-1">{{ row.weight ?? '—' }}</td>
              <td class="hidden py-1 sm:table-cell">
                <NuxtLink v-if="row.performedOn && row.sessionId" :to="`/workouts/sessions/${row.sessionId}`">
                  {{ recordDate(row.performedOn) }}
                </NuxtLink>
                <template v-else>—</template>
              </td>
              <td class="py-1">{{ row.estimate ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </template>
  </div>
</template>
