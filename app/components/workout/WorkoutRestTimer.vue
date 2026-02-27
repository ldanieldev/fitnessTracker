<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

const restTimer = useRestTimer()
const toast = useToast()

const presets = [
  { label: '30s', seconds: 30 },
  { label: '60s', seconds: 60 },
  { label: '90s', seconds: 90 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 }
]

const activePreset = ref(60)

function startWithPreset(seconds: number) {
  activePreset.value = seconds
  restTimer.start(seconds)
}

function restart() {
  restTimer.start(activePreset.value)
}

defineExpose({ restart })

restTimer.onComplete(() => {
  if (navigator.vibrate) {
    navigator.vibrate(200)
  }
  if (!open.value) {
    toast.add({ title: 'Rest complete!', icon: 'i-lucide-timer', color: 'success' })
  }
  open.value = false
})

// SVG ring: circumference drains as time elapses
const radius = 88
const circumference = 2 * Math.PI * radius
const strokeDashoffset = computed(() => {
  return (restTimer.progress.value / 100) * circumference
})
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
      <div class="flex flex-col items-center gap-6 px-6 pb-8 pt-2">
        <!-- Presets -->
        <div class="flex gap-2">
          <UButton
            v-for="preset in presets"
            :key="preset.seconds"
            :label="preset.label"
            :variant="activePreset === preset.seconds ? 'solid' : 'outline'"
            :color="activePreset === preset.seconds ? 'primary' : 'neutral'"
            size="sm"
            @click="startWithPreset(preset.seconds)"
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
          <span class="text-4xl font-bold font-mono">{{ restTimer.display.value }}</span>
        </div>

        <!-- Controls -->
        <div class="flex items-center gap-3">
          <UButton
            label="-5s"
            variant="outline"
            color="neutral"
            size="sm"
            @click="restTimer.adjustTime(-5)"
          />
          <UButton
            icon="i-lucide-rotate-ccw"
            label="Reset"
            variant="soft"
            color="neutral"
            @click="restTimer.reset()"
          />
          <UButton
            icon="i-lucide-skip-forward"
            label="Skip"
            variant="soft"
            color="primary"
            @click="restTimer.skip(); open = false"
          />
          <UButton
            label="+5s"
            variant="outline"
            color="neutral"
            size="sm"
            @click="restTimer.adjustTime(5)"
          />
        </div>
      </div>
    </template>
  </UDrawer>
</template>
