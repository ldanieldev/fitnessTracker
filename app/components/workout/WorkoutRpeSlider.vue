<script setup lang="ts">
const model = defineModel<number>({ default: 5 })

const rpeLabel = computed(() => {
  const v = model.value
  if (v <= 3) return 'Easy'
  if (v <= 6) return 'Moderate'
  if (v <= 8) return 'Hard'
  return 'Max Effort'
})

const rpeColor = computed(() => {
  const v = model.value
  if (v <= 3) return 'text-green-500'
  if (v <= 6) return 'text-yellow-500'
  return 'text-red-500'
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <span class="text-sm text-dimmed">RPE</span>
      <span class="text-sm font-semibold" :class="rpeColor">{{ model }} - {{ rpeLabel }}</span>
    </div>
    <div class="flex items-center gap-3">
      <UIcon name="i-lucide-smile" class="text-green-500 shrink-0 size-5" />
      <USlider
        v-model="model"
        :min="1"
        :max="10"
        :step="1"
        size="lg"
        class="flex-1"
        :ui="{
          track: 'bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 opacity-30',
          range: 'bg-transparent'
        }"
      />
      <UIcon name="i-lucide-flame" class="text-red-500 shrink-0 size-5" />
    </div>
  </div>
</template>
