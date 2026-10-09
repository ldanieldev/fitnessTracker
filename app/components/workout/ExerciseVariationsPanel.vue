<script setup lang="ts">
import type { ExerciseDetail } from '~~/shared/types/workout'
import ExerciseVariationPicker from './ExerciseVariationPicker.vue'

interface VariationGroup { id: number, name: string, exerciseIds: number[] }

const props = defineProps<{ exercise: ExerciseDetail }>()
const fail = useFailToast()

const { data: groups } = useExerciseFetch<VariationGroup[]>(EXERCISE_KEYS.variations, '/api/workouts/variations')
const group = computed(() => groups.value?.find((g) => g.exerciseIds.includes(props.exercise.id)))
const pickerOpen = ref(false)

async function onLink(payload: { groupId?: number, name?: string, exerciseId: number }) {
  try {
    if (payload.name) {
      await apiFetch('/api/workouts/variations', {
        method: 'POST',
        body: { name: payload.name, exerciseIds: [payload.exerciseId] }
      })
    } else if (payload.groupId !== undefined) {
      await apiFetch(`/api/workouts/variations/${payload.groupId}`, {
        method: 'PATCH',
        body: { addExerciseIds: [payload.exerciseId] }
      })
    }
    await invalidateExercises(EXERCISE_KEYS.variations, EXERCISE_KEYS.detail(props.exercise.id))
  } catch (err: unknown) {
    fail('Couldn\'t link variation', err, 'Could not link this variation')
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div data-test="variation-list" class="flex flex-col gap-2">
      <template v-if="group">
        <p class="text-sm font-medium text-highlighted">{{ group.name }}</p>
        <NuxtLink
          v-for="variation in exercise.variations"
          :key="variation.id"
          :to="`/workouts/exercises/${variation.id}`"
          class="flex min-h-10 items-center rounded-xl bg-elevated px-3 py-2 text-sm"
        >
          {{ variation.name }}
        </NuxtLink>
      </template>
      <p v-else class="text-sm text-dimmed">No variations linked yet</p>
    </div>
    <UButton
      label="Link variation"
      variant="soft"
      color="neutral"
      class="min-h-10"
      data-test="variation-link"
      @click="pickerOpen = true"
    />
    <ExerciseVariationPicker v-model:open="pickerOpen" :exercise="exercise" :groups="groups ?? []" @link="onLink" />
  </div>
</template>
