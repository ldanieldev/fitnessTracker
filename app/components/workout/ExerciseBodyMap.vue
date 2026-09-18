<script lang="ts">
import bodyMap from '~/assets/bodyMap.json'
import { MUSCLE_BODY_MAP, MUSCLE_CATEGORY } from '~~/shared/utils/exerciseSeedMap'

const GROUP_TO_KEY: Record<string, string> = {}
for (const [key, groups] of Object.entries(MUSCLE_BODY_MAP)) {
  for (const group of groups) GROUP_TO_KEY[group] = key
}
</script>

<script setup lang="ts">
const props = defineProps<{ selected: string[], available: string[] }>()
const emit = defineEmits<{ toggle: [key: string] }>()

const MUSCLE_KEYS = Object.keys(MUSCLE_CATEGORY)

const view = ref<'front' | 'back'>('front')
// Both sides are authored as separate CENTER paths at this MuscleMap commit — no mirror transform needed.
const diagram = computed(() => bodyMap[view.value])

const surfaces = computed(() =>
  diagram.value.muscles.map((muscle) => ({ id: muscle.id, d: muscle.d, key: GROUP_TO_KEY[muscle.group] ?? null }))
)

function isSelected(key: string) {
  return props.selected.includes(key)
}

function isAvailable(key: string) {
  return props.available.includes(key)
}

function displayName(key: string) {
  return key.replace(/\b\w/g, (c) => c.toUpperCase())
}

function toggle(key: string) {
  if (!isAvailable(key)) return
  emit('toggle', key)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex justify-center gap-2">
      <UButton
        :color="view === 'front' ? 'primary' : 'neutral'"
        :variant="view === 'front' ? 'solid' : 'soft'"
        size="sm"
        label="Front"
        data-test="body-view-front"
        @click="view = 'front'"
      />
      <UButton
        :color="view === 'back' ? 'primary' : 'neutral'"
        :variant="view === 'back' ? 'solid' : 'soft'"
        size="sm"
        label="Back"
        data-test="body-view-back"
        @click="view = 'back'"
      />
    </div>

    <svg :viewBox="diagram.viewBox" :data-view="view" data-test="body-map-svg" class="w-full h-auto">
      <path
        v-for="(d, index) in diagram.outline"
        :key="`outline-${index}`"
        :d="d"
        class="fill-neutral-200 dark:fill-neutral-800"
      />
      <path
        v-for="surface in surfaces"
        :key="surface.id"
        :d="surface.d"
        :role="surface.key ? 'button' : undefined"
        :tabindex="surface.key ? 0 : undefined"
        :aria-label="surface.key ? displayName(surface.key) : undefined"
        :aria-pressed="surface.key ? isSelected(surface.key) : undefined"
        :aria-disabled="surface.key && !isAvailable(surface.key) ? true : undefined"
        :data-test="surface.key ? `muscle-surface-${surface.key}` : undefined"
        class="transition-opacity"
        :class="[
          surface.key
            ? isSelected(surface.key) ? 'fill-primary' : 'fill-neutral-400 dark:fill-neutral-600'
            : 'fill-neutral-300 dark:fill-neutral-700 pointer-events-none',
          surface.key && isAvailable(surface.key) ? 'cursor-pointer' : '',
          surface.key && !isAvailable(surface.key) ? 'opacity-40 pointer-events-none' : ''
        ]"
        @click="surface.key && toggle(surface.key)"
        @keydown.enter.prevent="surface.key && toggle(surface.key)"
        @keydown.space.prevent="surface.key && toggle(surface.key)"
      />
    </svg>

    <div class="flex flex-wrap gap-2">
      <UButton
        v-for="key in MUSCLE_KEYS"
        :key="key"
        :label="displayName(key)"
        size="sm"
        :color="isSelected(key) ? 'primary' : 'neutral'"
        :variant="isSelected(key) ? 'solid' : 'soft'"
        :disabled="!isAvailable(key)"
        :class="isAvailable(key) ? '' : 'opacity-40'"
        :aria-pressed="isSelected(key)"
        :data-test="`muscle-${key}`"
        @click="toggle(key)"
      />
    </div>
  </div>
</template>
