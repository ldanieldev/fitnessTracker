<script setup lang="ts">
import type { StepWeek } from '~~/shared/types/steps'
import { formatSteps, stepCounts, stepsPaceText } from '~~/shared/utils/steps'

const today = useTodayOrNow()
const weeksFetch = useBodyFetch<StepWeek[]>(BODY_KEYS.stepWeeks(2), '/api/body/steps/weeks', {
  query: computed(() => ({ count: 2, to: today.value }))
})
await weeksFetch
const week = computed(() => weeksFetch.data.value?.[0] ?? null)
const todaySteps = computed(() => week.value?.days.find((d) => d.date === today.value)?.steps ?? null)
const known = computed(() => stepCounts(weeksFetch.data.value ?? []))
const logOpen = ref(false)
const targetOpen = ref(false)
</script>

<template>
  <UCard class="relative" data-test="steps-card">
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <div class="flex min-w-0 flex-1 flex-col">
          <NuxtLink
            to="/body/steps"
            class="inline-flex min-h-10 items-center font-medium after:absolute after:inset-0"
            data-test="steps-link"
            >Steps</NuxtLink
          >
          <span class="text-xs tabular-nums text-muted" data-test="steps-today">
            Today {{ formatSteps(todaySteps) }}
          </span>
        </div>
        <UButton
          icon="i-lucide-plus"
          label="Log"
          size="md"
          class="relative z-10 min-h-10"
          data-test="steps-log"
          @click="logOpen = true"
        />
      </div>
      <div class="flex items-baseline gap-1 tabular-nums">
        <span class="text-lg font-semibold text-highlighted" data-test="steps-total">{{
          formatSteps(week?.total ?? 0)
        }}</span>
        <span v-if="week?.budget != null" class="text-sm text-dimmed" data-test="steps-budget"
          >/ {{ formatSteps(week.budget) }}</span
        >
      </div>
      <template v-if="week?.budget != null">
        <UProgress
          :model-value="Math.min(week.total / week.budget, 1) * 100"
          :max="100"
          :color="week.remaining === 0 ? 'success' : 'primary'"
          size="sm"
        />
        <p v-if="stepsPaceText(week)" class="text-xs text-dimmed" data-test="steps-pace">{{ stepsPaceText(week) }}</p>
      </template>
      <UButton
        v-else
        label="Set a target"
        variant="link"
        class="relative z-10 min-h-10 self-start px-0"
        data-test="steps-set-target"
        @click="targetOpen = true"
      />
    </div>
    <BodyStepsSheet v-model:open="logOpen" :date="today" :known="known" />
    <BodyStepsTargetSheet v-model:open="targetOpen" :target="null" />
  </UCard>
</template>
