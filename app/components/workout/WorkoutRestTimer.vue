<script setup lang="ts">
import type { RestTimer } from '~/composables/useRestTimer'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ timer: RestTimer }>()

const { defaultRestSeconds } = useWorkoutPrefs()
const BASE_PRESETS = [30, 60, 90, 120, 180]

function presetLabel(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes}m${rest}s` : `${minutes}m`
}

const active = computed(() => (props.timer.isRunning.value ? props.timer.totalSeconds.value : defaultRestSeconds.value))
const presets = computed(() =>
  [...new Set([...BASE_PRESETS, defaultRestSeconds.value, active.value])]
    .sort((a, b) => a - b)
    .map((seconds) => ({ label: presetLabel(seconds), seconds })))

// SVG ring: circumference drains as time elapses
const radius = 88
const circumference = 2 * Math.PI * radius
const strokeDashoffset = computed(() => (props.timer.progress.value / 100) * circumference)
</script>

<template>
  <UDrawer
    v-model:open="open"
    direction="bottom"
    handle
    :dismissible="true"
    :should-scale-background="false"
  >
    <template #default />

    <template #content>
      <div class="flex flex-col items-center gap-6 px-6 pb-8 pt-2" data-test="rest-timer">
        <!-- Presets -->
        <div class="flex flex-wrap justify-center gap-2">
          <UButton
            v-for="preset in presets"
            :key="preset.seconds"
            :label="preset.label"
            :variant="active === preset.seconds ? 'solid' : 'outline'"
            :color="active === preset.seconds ? 'primary' : 'neutral'"
            size="sm"
            @click="timer.start(preset.seconds)"
          />
        </div>

        <!-- Countdown ring -->
        <div class="relative flex items-center justify-center w-48 h-48">
          <svg class="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              :r="radius"
              fill="none"
              class="stroke-elevated"
              stroke-width="10"
            />
            <circle
              cx="100"
              cy="100"
              :r="radius"
              fill="none"
              class="stroke-primary transition-all duration-300 ease-linear"
              stroke-width="10"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="strokeDashoffset"
            />
          </svg>
          <span class="text-4xl font-bold font-mono">{{ timer.display.value }}</span>
        </div>

        <!-- Controls -->
        <div class="flex items-center gap-3">
          <UButton
            label="-5s"
            variant="outline"
            color="neutral"
            size="sm"
            @click="timer.adjustTime(-5)"
          />
          <UButton
            icon="i-lucide-rotate-ccw"
            label="Reset"
            variant="soft"
            color="neutral"
            @click="timer.reset()"
          />
          <UButton
            icon="i-lucide-skip-forward"
            label="Skip"
            variant="soft"
            color="primary"
            @click="timer.skip(); open = false"
          />
          <UButton
            label="+5s"
            variant="outline"
            color="neutral"
            size="sm"
            @click="timer.adjustTime(5)"
          />
        </div>
      </div>
    </template>
  </UDrawer>
</template>
