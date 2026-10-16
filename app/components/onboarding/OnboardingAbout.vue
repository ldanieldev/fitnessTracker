<script setup lang="ts">
import * as z from 'zod'
import { HEIGHT_MAX_IN, HEIGHT_MIN_IN, joinHeight, splitHeight } from '~~/shared/utils/height'

const { user } = useUserSession()
const saveUser = useSaveUser()
const form = useTemplateRef('form')

const schema = z.object({
  age: z.number({ message: 'Age is required' }).int().min(13, 'Must be at least 13 years old').max(120, 'Invalid age'),
  sex: z.enum(['m', 'f'], { message: 'Sex is required' }),
  heightFeet: z.number().int('Whole feet').min(0).nullable().optional(),
  heightInches: z.number().min(0).max(95.9).nullable().optional()
}).superRefine((data, ctx) => {
  const total = joinHeight(data.heightFeet, data.heightInches)
  if (total !== null && (total < HEIGHT_MIN_IN || total > HEIGHT_MAX_IN)) {
    ctx.addIssue({ code: 'custom', path: ['heightFeet'], message: 'Height must be 3′ to 8′' })
  }
})

defineExpose({ save })

// Read from the DB: height is not on the session user.
const { data: row } = await useFetch<{ heightIn: string | null }>(`/api/users/${user.value!.id}`, {
  key: 'onboarding:profile-row'
})
const height = splitHeight(row.value?.heightIn == null ? null : Number(row.value.heightIn))

const state = reactive({
  // OAuth signups are created with age 0, which is a placeholder, not an answer.
  age: user.value?.age ? user.value.age : undefined,
  sex: (user.value?.sex as 'm' | 'f' | null) ?? undefined,
  heightFeet: height.feet,
  heightInches: height.inches
})

async function save() {
  try {
    await form.value!.validate({})
  } catch {
    return false
  }
  return saveUser(
    { age: state.age, sex: state.sex, heightIn: joinHeight(state.heightFeet, state.heightInches) },
    'Could not save your details'
  )
}
</script>

<template>
  <UForm
    ref="form"
    name="onboarding-about"
    :schema="schema"
    :state="state"
    class="flex flex-col gap-4"
    data-test="onboarding-step-about"
  >
    <UFormField label="Age" name="age" required>
      <AppNumberInput v-model="state.age" :min="13" :max="120" :step="1" aria-label="Age" data-test="onboarding-age" />
    </UFormField>
    <UFormField label="Sex" name="sex" required>
      <USelect
        v-model="state.sex"
        :items="[{ label: 'Male', value: 'm' }, { label: 'Female', value: 'f' }]"
        placeholder="Select"
        aria-label="Sex"
        class="w-full"
        data-test="onboarding-sex"
      />
    </UFormField>
    <fieldset class="flex flex-col gap-2">
      <legend class="text-sm font-medium text-default">Height <span class="text-dimmed">(optional)</span></legend>
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Feet" name="heightFeet">
          <AppNumberInput v-model="state.heightFeet" :min="0" :step="1" aria-label="Height feet" />
        </UFormField>
        <UFormField label="Inches" name="heightInches">
          <AppNumberInput v-model="state.heightInches" :min="0" :step="0.5" aria-label="Height inches" />
        </UFormField>
      </div>
    </fieldset>
  </UForm>
</template>
