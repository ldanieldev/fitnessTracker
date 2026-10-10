<script setup lang="ts">
import { format } from 'date-fns'
import type { StepWeek, StepWeekDay } from '~~/shared/types/steps'
import { formatSteps, formatStepsCompact } from '~~/shared/utils/steps'

const props = defineProps<{ week: StepWeek; today: string; lastWeekTotal: number | null }>()
const emit = defineEmits<{ pick: [date: string] }>()

const target = computed(() => props.week.days.find((d) => d.date === props.today)?.target ?? props.week.days[6]!.target)
const scale = computed(() => Math.max(target.value ?? 0, ...props.week.days.map((d) => d.steps ?? 0), 1))
const pct = (value: number) => (value / scale.value) * 100
// Rounds down so a day just under the target never reads as the target (7,950 → 7.9k, not 8k).
const short = (value: number) => (value >= 1000 ? `${Math.floor(value / 100) / 10}k` : String(value))
// Below ~16 px of the 120 px column the check would spill out of the bar.
const roomForCheck = (value: number) => pct(value) >= 14

function label(d: StepWeekDay) {
  const day = format(new Date(`${d.date}T00:00:00`), 'EEE, MMM d')
  return d.steps === null ? `Log steps for ${day}` : `Edit steps for ${day}, ${formatSteps(d.steps)} steps`
}

const hit = (d: StepWeekDay) => d.steps !== null && d.target !== null && d.steps >= d.target
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="font-medium">This week</h2>
      <p class="text-sm text-muted">
        Last week
        <span class="ml-1 font-semibold tabular-nums text-toned" data-test="steps-last-week">
          {{ lastWeekTotal ? formatSteps(lastWeekTotal) : '—' }}
        </span>
      </p>
    </div>
    <div class="relative">
      <div
        v-if="target !== null"
        class="pointer-events-none absolute inset-x-0 bottom-6 top-6"
        aria-hidden="true"
      >
        <div
          class="absolute inset-x-0 border-t border-dashed border-(--ui-text-dimmed)"
          :style="{ bottom: `${pct(target)}%` }"
          data-test="steps-target-line"
        >
          <span class="absolute -top-4 right-0 text-[10px] text-dimmed">{{ formatStepsCompact(target) }}</span>
        </div>
      </div>
      <div class="grid grid-cols-7 gap-1">
        <button
          v-for="d in week.days"
          :key="d.date"
          type="button"
          class="flex flex-col items-center gap-1 rounded-lg py-1 transition-colors hover:bg-accented
            focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50
            disabled:hover:bg-transparent"
          :disabled="d.date > today"
          :aria-label="d.date > today ? undefined : label(d)"
          :data-test="`steps-day-${d.date}`"
          @click="emit('pick', d.date)"
        >
          <span class="h-4 text-[10px] leading-4 tabular-nums text-muted" :data-test="`steps-count-${d.date}`">
            {{ d.steps === null ? '' : short(d.steps) }}
          </span>
          <span class="flex h-30 w-full items-end justify-center">
            <span
              v-if="d.steps !== null"
              class="relative w-3/4 rounded-t-md rounded-b-sm"
              :class="hit(d) ? 'bg-primary' : 'bg-primary/50'"
              :style="{ height: `${pct(d.steps)}%`, minHeight: '4px' }"
              :data-test="`steps-bar-${d.date}`"
            >
              <span
                v-if="hit(d)"
                class="absolute inset-x-0 top-1 flex justify-center"
                :data-test="`steps-hit-${d.date}`"
              >
                <UIcon
                  v-if="roomForCheck(d.steps)"
                  name="i-lucide-check"
                  class="size-3 text-inverted"
                  :data-test="`steps-hit-icon-${d.date}`"
                />
                <span class="sr-only">Target met</span>
              </span>
            </span>
            <span
              v-else-if="d.date <= today"
              class="flex h-12 w-3/4 items-center justify-center rounded-md border-[1.5px] border-dashed"
              :class="d.date === today ? 'border-primary bg-primary/10' : 'border-accented'"
              :data-today="d.date === today ? 'true' : undefined"
              :data-test="`steps-add-${d.date}`"
            >
              <UIcon name="i-lucide-plus" class="size-5 text-primary" />
            </span>
            <span v-else class="h-1.5 w-3/4 rounded-full bg-accented" />
          </span>
          <span
            class="h-4 text-[11px] leading-4"
            :class="d.date === today ? 'font-semibold text-highlighted' : 'text-dimmed'"
          >
            {{ format(new Date(`${d.date}T00:00:00`), 'EEE') }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
