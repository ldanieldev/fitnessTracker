<script setup lang="ts">
import type { MuscleRow } from '~~/shared/types/workout'
import bodyMap from '~/assets/bodyMap.json'

type BodyMapMuscle = Pick<MuscleRow, 'key' | 'name' | 'bodyMapGroups'>

const props = defineProps<{ muscles: BodyMapMuscle[], selected: string[], available: string[], pending?: boolean }>()
const emit = defineEmits<{ toggle: [key: string] }>()

const view = ref<'front' | 'back'>('front')
// Both sides are authored as separate CENTER paths at this MuscleMap commit — no mirror transform needed.
const diagram = computed(() => bodyMap[view.value])

const keyByGroup = computed(() => {
  const map = new Map<string, string>()
  for (const muscle of props.muscles) for (const group of muscle.bodyMapGroups) map.set(group, muscle.key)
  return map
})
const nameByKey = computed(() => new Map(props.muscles.map((muscle) => [muscle.key, muscle.name])))

const surfaces = computed(() =>
  diagram.value.muscles.map((muscle) => ({ id: muscle.id, d: muscle.d, key: keyByGroup.value.get(muscle.group) ?? null }))
)

function isSelected(key: string) {
  return props.selected.includes(key)
}

function isAvailable(key: string) {
  return props.available.includes(key)
}

function displayName(key: string) {
  return nameByKey.value.get(key) ?? key
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
        :ui="{ base: 'min-h-10' }"
        label="Front"
        data-test="body-view-front"
        @click="view = 'front'"
      />
      <UButton
        :color="view === 'back' ? 'primary' : 'neutral'"
        :variant="view === 'back' ? 'solid' : 'soft'"
        size="sm"
        :ui="{ base: 'min-h-10' }"
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
          surface.key && !isAvailable(surface.key) ? (pending ? 'pointer-events-none' : 'opacity-40 pointer-events-none') : ''
        ]"
        @click="surface.key && toggle(surface.key)"
        @keydown.enter.prevent="surface.key && toggle(surface.key)"
        @keydown.space.prevent="surface.key && toggle(surface.key)"
      />
    </svg>

    <div class="flex flex-wrap gap-2">
      <UButton
        v-for="muscle in muscles"
        :key="muscle.key"
        :label="muscle.name"
        size="sm"
        :ui="{ base: 'min-h-10' }"
        :color="isSelected(muscle.key) ? 'primary' : 'neutral'"
        :variant="isSelected(muscle.key) ? 'solid' : 'soft'"
        :disabled="!isAvailable(muscle.key)"
        :class="isAvailable(muscle.key) || pending ? '' : 'opacity-40'"
        :aria-pressed="isSelected(muscle.key)"
        :data-test="`muscle-${muscle.key}`"
        @click="toggle(muscle.key)"
      />
    </div>
  </div>
</template>
