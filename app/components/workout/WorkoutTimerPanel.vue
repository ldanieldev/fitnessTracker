<script setup lang="ts">
import type { RestTimer } from '~/composables/useRestTimer'

const props = defineProps<{ timer: RestTimer }>()
const emit = defineEmits<{ skip: [] }>()

const { defaultRestSeconds } = useWorkoutPrefs()
const BASE_PRESETS = [30, 60, 90, 120, 180]

function presetLabel(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes}m${rest}s` : `${minutes}m`
}

const selected = ref<number | null>(null)
const idleSeconds = computed(() => selected.value ?? defaultRestSeconds.value)
const active = computed(() => (props.timer.isRunning.value ? props.timer.totalSeconds.value : idleSeconds.value))
const presets = computed(() =>
  [...new Set([...BASE_PRESETS, defaultRestSeconds.value, active.value])]
    .sort((a, b) => a - b)
    .map((seconds) => ({ label: presetLabel(seconds), seconds }))
)

function pick(seconds: number) {
  if (props.timer.isRunning.value) props.timer.start(seconds)
  else selected.value = seconds
}

function adjust(delta: number) {
  if (props.timer.isRunning.value) props.timer.adjustTime(delta)
  else selected.value = Math.max(5, idleSeconds.value + delta)
}

const pad = (value: number) => String(value).padStart(2, '0')
const label = computed(() => {
  if (props.timer.isRunning.value) return props.timer.display.value
  return `${pad(Math.floor(idleSeconds.value / 60))}:${pad(idleSeconds.value % 60)}`
})

// SVG ring: circumference drains as time elapses
const radius = 88
const circumference = 2 * Math.PI * radius
const strokeDashoffset = computed(() => (props.timer.progress.value / 100) * circumference)
</script>

<template>
  <div class="flex flex-col items-center gap-6">
    <div class="flex flex-wrap justify-center gap-2">
      <UButton
        v-for="preset in presets"
        :key="preset.seconds"
        :label="preset.label"
        :variant="active === preset.seconds ? 'solid' : 'outline'"
        :color="active === preset.seconds ? 'primary' : 'neutral'"
        size="sm"
        @click="pick(preset.seconds)"
      />
    </div>

    <div class="relative flex items-center justify-center w-48 h-48">
      <svg class="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
        <circle cx="100" cy="100" :r="radius" fill="none" class="stroke-elevated" stroke-width="10" />
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
      <span class="text-4xl font-bold font-mono">{{ label }}</span>
    </div>

    <div class="flex items-center gap-3">
      <UButton label="-5s" variant="outline" color="neutral" size="sm" @click="adjust(-5)" />
      <template v-if="timer.isRunning.value">
        <UButton icon="i-lucide-rotate-ccw" label="Reset" variant="soft" color="neutral" @click="timer.reset()" />
        <UButton
          icon="i-lucide-skip-forward"
          label="Skip"
          variant="soft"
          color="primary"
          @click="timer.skip(); emit('skip')"
        />
      </template>
      <UButton v-else icon="i-lucide-play" label="Start" data-test="timer-start" @click="timer.start(idleSeconds)" />
      <UButton label="+5s" variant="outline" color="neutral" size="sm" @click="adjust(5)" />
    </div>
  </div>
</template>
