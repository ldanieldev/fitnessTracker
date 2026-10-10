<script setup lang="ts">
import type { StepWeek } from '~~/shared/types/steps'
import { formatSteps, stepsPaceText } from '~~/shared/utils/steps'

const props = defineProps<{ week: StepWeek }>()
const emit = defineEmits<{ log: []; setTarget: [] }>()

const RADIUS = 50
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const share = computed(() => (props.week.budget ? Math.min(props.week.total / props.week.budget, 1) : null))
</script>

<template>
  <UCard>
    <div class="flex items-center gap-4">
      <svg
        v-if="share !== null"
        viewBox="0 0 120 120"
        class="size-28 shrink-0"
        role="img"
        :aria-label="`${Math.round(share * 100)}% of the weekly budget`"
        data-test="steps-ring"
      >
        <circle cx="60" cy="60" :r="RADIUS" fill="none" stroke-width="12" style="stroke: var(--ui-bg-accented)" />
        <circle
          cx="60"
          cy="60"
          :r="RADIUS"
          fill="none"
          stroke-width="12"
          stroke-linecap="round"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="CIRCUMFERENCE * (1 - share)"
          transform="rotate(-90 60 60)"
          :style="{ stroke: week.remaining === 0 ? 'var(--ui-success)' : 'var(--ui-primary)' }"
        />
        <text x="60" y="60" text-anchor="middle" class="text-[22px] font-bold" style="fill: var(--ui-text-highlighted)">
          {{ Math.round(share * 100) }}%
        </text>
        <text x="60" y="78" text-anchor="middle" class="text-[11px]" style="fill: var(--ui-text-dimmed)">of week</text>
      </svg>
      <div class="flex min-w-0 flex-col">
        <span class="text-xs uppercase tracking-wide text-muted">This week</span>
        <span class="text-3xl font-bold tabular-nums text-highlighted" data-test="steps-hero-total">
          {{ formatSteps(week.total) }}
        </span>
        <span v-if="week.budget !== null" class="text-sm tabular-nums text-dimmed">
          of {{ formatSteps(week.budget) }}
        </span>
        <span v-if="stepsPaceText(week)" class="text-sm tabular-nums text-toned">{{ stepsPaceText(week) }}</span>
      </div>
    </div>
    <div class="mt-4 flex flex-col gap-2">
      <UButton
        icon="i-lucide-plus"
        label="Log today's steps"
        size="lg"
        block
        class="min-h-11"
        data-test="steps-hero-log"
        @click="emit('log')"
      />
      <UButton
        v-if="week.budget === null"
        label="Set a target"
        color="neutral"
        variant="subtle"
        block
        class="min-h-10"
        data-test="steps-hero-set-target"
        @click="emit('setTarget')"
      />
    </div>
  </UCard>
</template>
