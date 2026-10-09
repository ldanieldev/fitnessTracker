<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { DEFAULT_PLATE_SIZES, plateSizesSchema } from '~~/shared/utils/plates'
import WorkoutPlateSizesPicker from '~/components/workout/WorkoutPlateSizesPicker.vue'

const { user, fetch: fetchSession } = useUserSession()
const { defaultRestSeconds, plateSizes, oneRepMaxRepCap } = useWorkoutPrefs()
const toast = useToast()

const schema = z.object({
  defaultRestSeconds: z.number({ message: 'Default rest is required' }).int().min(10).max(600),
  plateSizes: plateSizesSchema.optional(),
  oneRepMaxRepCap: z.number({ message: 'Rep cap is required' }).int().min(1).max(20).optional()
})

type Schema = z.input<typeof schema>

// A session predating plate sizes only has the read fallback, which must never be PUT over the stored plates.
const canEditPlates = computed(() => Array.isArray(user.value?.plateSizes))
// Same problem for the rep cap: a pre-column session falls back to 10, which must never be PUT over the real value.
const canEditRepCap = computed(() => typeof user.value?.oneRepMaxRepCap === 'number')

const state = reactive<Partial<Schema>>({
  defaultRestSeconds: defaultRestSeconds.value,
  plateSizes: canEditPlates.value ? [...plateSizes.value] : undefined,
  oneRepMaxRepCap: canEditRepCap.value ? oneRepMaxRepCap.value : undefined
})

const loading = ref(false)

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await apiFetch(`/api/users/${user.value!.id}`, {
      method: 'PUT',
      body: payload.data
    })
    await fetchSession()
    toast.add({
      title: 'Preferences updated',
      color: 'success'
    })
  } catch (error: unknown) {
    const message = error instanceof Error && 'data' in error
      ? (error as { data?: { statusMessage?: string } }).data?.statusMessage
      : undefined
    toast.add({
      title: 'Update failed',
      description: message || 'Could not update preferences',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12">
    <UPageCard
      title="Workout"
      description="Defaults for every exercise; an exercise's own Settings tab can override them. Sets above the rep cap are left out of estimated 1RM."
      variant="subtle"
    >
      <UForm :schema="schema" :state="state" class="flex flex-col gap-4 max-w-xs" @submit="onSubmit">
        <UFormField label="Default rest" name="defaultRestSeconds" hint="seconds" required>
          <AppNumberInput v-model="state.defaultRestSeconds" :min="10" :step="15" data-test="setting-default-rest" />
        </UFormField>

        <UFormField label="1RM rep cap" name="oneRepMaxRepCap" hint="reps" :required="canEditRepCap">
          <AppNumberInput
            v-if="canEditRepCap"
            v-model="state.oneRepMaxRepCap"
            :min="1"
            :max="20"
            :step="1"
            data-test="setting-rep-cap"
          />
          <p v-else class="text-sm text-dimmed">Sign in again to edit your 1RM rep cap.</p>
        </UFormField>

        <UFormField label="Plates" name="plateSizes" hint="lb, both sides">
          <WorkoutPlateSizesPicker
            v-if="canEditPlates"
            :model-value="state.plateSizes ?? []"
            :choices="DEFAULT_PLATE_SIZES"
            @update:model-value="(sizes) => state.plateSizes = sizes"
          />
          <p v-else class="text-sm text-dimmed">Sign in again to edit your plates.</p>
        </UFormField>

        <UButton type="submit" label="Save changes" :loading="loading" class="w-fit" />
      </UForm>
    </UPageCard>
  </div>
</template>
