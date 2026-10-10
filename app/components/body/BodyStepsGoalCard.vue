<script setup lang="ts">
import type { StepTarget } from '~~/shared/types/steps'
import { formatSteps } from '~~/shared/utils/steps'

const today = useTodayOrNow()
const targetFetch = useBodyFetch<{ target: StepTarget | null }>(BODY_KEYS.stepTarget, '/api/body/steps/target', {
  query: computed(() => ({ to: today.value }))
})
await targetFetch
const target = computed(() => targetFetch.data.value?.target ?? null)
const open = ref(false)
</script>

<template>
  <UCard data-test="steps-goal">
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <NuxtLink to="/body/steps" class="flex min-h-10 flex-1 items-center truncate font-medium">Steps</NuxtLink>
        <UButton
          icon="i-lucide-pencil"
          variant="subtle"
          color="neutral"
          size="sm"
          class="min-h-10 min-w-10 justify-center"
          aria-label="Edit steps target"
          data-test="steps-goal-edit"
          @click="open = true"
        />
      </div>
      <p class="text-sm tabular-nums" data-test="steps-goal-target">
        {{
          target ? `${formatSteps(target.dailyTarget)}/day · ${formatSteps(target.dailyTarget * 7)}/week` : 'No target'
        }}
      </p>
    </div>
    <BodyStepsTargetSheet v-model:open="open" :target="target" />
  </UCard>
</template>
