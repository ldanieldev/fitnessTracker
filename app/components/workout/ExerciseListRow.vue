<script lang="ts">
import type { Exercise } from '~~/shared/types/workout'
import { CATEGORY_DOT_CLASS } from '~~/shared/utils/categoryColors'

function titleCase(key: string) {
  return key.replace(/(^|[\s-])([a-z])/g, (_match, sep, letter) => sep + letter.toUpperCase())
}
</script>

<script setup lang="ts">
const props = defineProps<{ exercise: Exercise }>()
const emit = defineEmits<{ favorite: [id: number]; hide: [id: number]; edit: [id: number]; fork: [id: number] }>()

const dotClass = computed(() => CATEGORY_DOT_CLASS[props.exercise.category.color] ?? CATEGORY_DOT_CLASS.fallback)

const subtitle = computed(() => {
  const equipment = props.exercise.equipment.map(titleCase).join(', ')
  return equipment ? `${props.exercise.category.name} · ${equipment}` : props.exercise.category.name
})
</script>

<template>
  <div
    class="relative flex flex-col gap-1 rounded-xl bg-elevated px-3 py-2"
    :class="exercise.hidden ? 'opacity-60' : ''"
    data-test="exercise-row"
  >
    <NuxtLink
      :to="`/workouts/exercises/${exercise.id}`"
      class="flex items-start gap-2 after:absolute after:inset-0 after:content-['']"
      :data-test="`exercise-link-${exercise.id}`"
    >
      <span
        class="mt-1.5 size-2.5 shrink-0 rounded-full"
        :class="dotClass"
        :data-test="`exercise-category-${exercise.id}`"
      />
      <span class="line-clamp-2 font-medium leading-snug text-highlighted">{{ exercise.name }}</span>
    </NuxtLink>
    <div class="flex items-center justify-between gap-2 pl-4.5">
      <div class="flex min-w-0 items-center gap-2">
        <span class="truncate text-xs text-dimmed">{{ subtitle }}</span>
        <UBadge v-if="exercise.hidden" label="Hidden" variant="subtle" color="neutral" size="sm" />
      </div>
      <div class="relative z-10 flex shrink-0 items-center gap-1">
        <UButton
          icon="i-lucide-star"
          size="md"
          variant="ghost"
          color="neutral"
          class="min-h-10 min-w-10 justify-center"
          :class="exercise.favorite ? 'text-amber-400' : ''"
          :aria-label="exercise.favorite ? 'Unfavorite' : 'Favorite'"
          :data-test="`exercise-favorite-toggle-${exercise.id}`"
          @click="emit('favorite', exercise.id)"
        />
        <UButton
          :icon="exercise.hidden ? 'i-lucide-eye' : 'i-lucide-eye-off'"
          size="md"
          variant="ghost"
          color="neutral"
          class="min-h-10 min-w-10 justify-center"
          :aria-label="exercise.hidden ? 'Unhide' : 'Hide'"
          :data-test="`exercise-hide-${exercise.id}`"
          @click="emit('hide', exercise.id)"
        />
        <UButton
          v-if="exercise.shared"
          icon="i-lucide-copy"
          size="md"
          variant="ghost"
          color="neutral"
          class="min-h-10 min-w-10 justify-center"
          aria-label="Make your own copy"
          :data-test="`exercise-fork-${exercise.id}`"
          @click="emit('fork', exercise.id)"
        />
        <UButton
          v-else
          icon="i-lucide-pencil"
          size="md"
          variant="ghost"
          color="neutral"
          class="min-h-10 min-w-10 justify-center"
          aria-label="Edit"
          :data-test="`exercise-edit-${exercise.id}`"
          @click="emit('edit', exercise.id)"
        />
      </div>
    </div>
  </div>
</template>
