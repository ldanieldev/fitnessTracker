<script setup lang="ts">
import * as z from 'zod'
import { DEFAULT_PLATE_SIZES, plateSizesSchema } from '~~/shared/utils/plates'
import WorkoutPlateSizesPicker from '~/components/workout/WorkoutPlateSizesPicker.vue'

const { user } = useUserSession()
const { defaultRestSeconds, plateSizes, workoutsPerWeek } = useWorkoutPrefs()
const saveUser = useSaveUser()
const form = useTemplateRef('form')

const schema = z.object({
  weekStart: z.union([z.literal(0), z.literal(1)]),
  workoutsPerWeek: z.number({ message: 'Workouts per week is required' }).int().min(1).max(7),
  defaultRestSeconds: z.number({ message: 'Default rest is required' }).int().min(10).max(600),
  plateSizes: plateSizesSchema
})

type Schema = z.input<typeof schema>

defineExpose({ save })

const state = reactive<Partial<Schema>>({
  weekStart: user.value?.weekStart ?? 1,
  workoutsPerWeek: workoutsPerWeek.value,
  defaultRestSeconds: defaultRestSeconds.value,
  plateSizes: [...plateSizes.value]
})

async function save() {
  try {
    await form.value!.validate({})
  } catch {
    return false
  }
  return saveUser(
    {
      weekStart: state.weekStart,
      workoutsPerWeek: state.workoutsPerWeek,
      defaultRestSeconds: state.defaultRestSeconds,
      plateSizes: state.plateSizes
    },
    'Could not save your workout settings'
  )
}
</script>

<template>
  <UForm
    ref="form"
    name="onboarding-workouts"
    :schema="schema"
    :state="state"
    class="flex flex-col gap-4"
    data-test="onboarding-step-workouts"
  >
    <UFormField label="Week starts on" name="weekStart" required>
      <USelect
        v-model="state.weekStart"
        :items="[{ label: 'Sunday', value: 0 }, { label: 'Monday', value: 1 }]"
        aria-label="Week starts on"
        class="w-full"
        data-test="onboarding-week-start"
      />
    </UFormField>
    <UFormField label="Workouts per week" name="workoutsPerWeek" hint="when no program" required>
      <AppNumberInput
        v-model="state.workoutsPerWeek"
        :min="1"
        :max="7"
        :step="1"
        aria-label="Workouts per week"
        data-test="onboarding-workouts-per-week"
      />
    </UFormField>
    <UFormField label="Default rest" name="defaultRestSeconds" hint="seconds" required>
      <AppNumberInput
        v-model="state.defaultRestSeconds"
        :min="10"
        :step="15"
        aria-label="Default rest"
        data-test="onboarding-default-rest"
      />
    </UFormField>
    <UFormField label="Plates" name="plateSizes" hint="lb, both sides">
      <WorkoutPlateSizesPicker
        :model-value="state.plateSizes ?? []"
        :choices="DEFAULT_PLATE_SIZES"
        @update:model-value="(sizes) => (state.plateSizes = sizes)"
      />
    </UFormField>
  </UForm>
</template>
