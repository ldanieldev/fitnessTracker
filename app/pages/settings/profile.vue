<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { HEIGHT_MAX_IN, HEIGHT_MIN_IN, joinHeight, splitHeight } from '~~/shared/utils/height'

const { user, fetch: fetchSession } = useUserSession()
const toast = useToast()

const schema = z.object({
  name: z.string({ message: 'Name is required' }).min(1, 'Name is required'),
  email: z.string({ message: 'Email is required' }).email('Invalid email'),
  age: z.coerce.number({ message: 'Age is required' }).min(13, 'Must be at least 13 years old').max(120, 'Invalid age'),
  sex: z.enum(['m', 'f'], { message: 'Sex is required' }),
  avatarUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  heightFeet: z.number().int('Whole feet').min(0).nullable().optional(),
  heightInches: z.number().min(0).max(95.9).nullable().optional()
}).superRefine((data, ctx) => {
  const total = joinHeight(data.heightFeet, data.heightInches)
  if (total !== null && (total < HEIGHT_MIN_IN || total > HEIGHT_MAX_IN)) {
    ctx.addIssue({ code: 'custom', path: ['heightFeet'], message: 'Height must be 3′ to 8′' })
  }
})

type Schema = z.input<typeof schema>

// Read from the DB, not the session user: sessions signed in before height existed would show it blank.
const { data: profileRow } = await useFetch<{ heightIn: string | null }>(`/api/users/${user.value!.id}`, {
  key: 'settings:profile-row'
})
const savedHeight = splitHeight(profileRow.value?.heightIn == null ? null : Number(profileRow.value.heightIn))

const state = reactive<Partial<Schema>>({
  name: user.value?.name ?? '',
  email: user.value?.email ?? '',
  age: user.value?.age ?? undefined,
  sex: (user.value?.sex as 'm' | 'f') ?? undefined,
  avatarUrl: user.value?.avatar_url ?? '',
  heightFeet: savedHeight.feet,
  heightInches: savedHeight.inches
})

const loading = ref(false)

const preferencesSchema = z.object({
  weekStart: z.union([z.literal(0), z.literal(1)]),
  showBody: z.boolean(),
  showWorkouts: z.boolean(),
  showNutrition: z.boolean()
})

type PreferencesSchema = z.input<typeof preferencesSchema>

const preferencesState = reactive<Partial<PreferencesSchema>>({
  weekStart: user.value?.weekStart ?? 1,
  showBody: user.value?.showBody ?? true,
  showWorkouts: user.value?.showWorkouts ?? true,
  showNutrition: user.value?.showNutrition ?? true
})

const preferencesLoading = ref(false)

async function onPreferencesSubmit(payload: FormSubmitEvent<PreferencesSchema>) {
  preferencesLoading.value = true
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
    const message =
      error instanceof Error && 'data' in error
        ? (error as { data?: { statusMessage?: string } }).data?.statusMessage
        : undefined
    toast.add({
      title: 'Update failed',
      description: message || 'Could not update preferences',
      color: 'error'
    })
  } finally {
    preferencesLoading.value = false
  }
}

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  loading.value = true
  const { heightFeet, heightInches, ...profile } = payload.data
  try {
    await apiFetch(`/api/users/${user.value!.id}`, {
      method: 'PUT',
      body: { ...profile, heightIn: joinHeight(heightFeet, heightInches) }
    })
    await fetchSession()
    toast.add({
      title: 'Profile updated',
      color: 'success'
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error && 'data' in error
        ? (error as { data?: { statusMessage?: string } }).data?.statusMessage
        : undefined
    toast.add({
      title: 'Update failed',
      description: message || 'Could not update profile',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12">
    <UPageCard title="Profile" description="Update your personal information." variant="subtle">
      <!-- An explicit name: its "name" input shadows form.name, so Vue would otherwise write name="undefined". -->
      <UForm name="profile" :schema="schema" :state="state" class="flex flex-col gap-4 max-w-xs" @submit="onSubmit">
        <div class="flex items-center gap-4">
          <UAvatar :src="state.avatarUrl || undefined" :alt="state.name" size="lg" />
          <UFormField label="Avatar URL" name="avatarUrl" class="flex-1">
            <UInput v-model="state.avatarUrl" placeholder="https://example.com/avatar.jpg" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Name" name="name" required>
          <UInput v-model="state.name" placeholder="Enter your name" class="w-full" />
        </UFormField>

        <UFormField label="Email" name="email" required>
          <UInput v-model="state.email" type="email" placeholder="Enter your email" class="w-full" />
        </UFormField>

        <UFormField label="Age" name="age" required>
          <UInput v-model="state.age as string" type="number" placeholder="Enter your age" class="w-full" />
        </UFormField>

        <UFormField label="Sex" name="sex" required>
          <USelect
            v-model="state.sex"
            :items="[
              { label: 'Male', value: 'm' },
              { label: 'Female', value: 'f' }
            ]"
            placeholder="Select your sex"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Height" name="heightFeet" hint="optional">
          <div class="flex items-center gap-2">
            <AppNumberInput
              v-model="state.heightFeet"
              :min="0"
              :step="1"
              aria-label="Height feet"
              data-test="profile-height-feet"
            />
            <span class="text-sm text-muted">ft</span>
            <AppNumberInput
              v-model="state.heightInches"
              :min="0"
              :step="0.5"
              aria-label="Height inches"
              data-test="profile-height-inches"
            />
            <span class="text-sm text-muted">in</span>
          </div>
        </UFormField>

        <UButton type="submit" label="Save changes" :loading="loading" class="w-fit" />
      </UForm>
    </UPageCard>

    <UPageCard title="Preferences" description="Customize how the app behaves for you." variant="subtle">
      <UForm
        :schema="preferencesSchema"
        :state="preferencesState"
        class="flex flex-col gap-4 max-w-xs"
        @submit="onPreferencesSubmit"
      >
        <UFormField label="Week starts on" name="weekStart" required>
          <USelect
            v-model="preferencesState.weekStart"
            :items="[
              { label: 'Sunday', value: 0 },
              { label: 'Monday', value: 1 }
            ]"
            class="w-full"
          />
        </UFormField>

        <fieldset class="flex flex-col gap-3">
          <legend class="text-sm font-medium text-default">Sections</legend>
          <p class="text-sm text-muted">Hidden sections leave the sidebar, dashboard and settings.</p>
          <USwitch v-model="preferencesState.showBody" label="Body" aria-label="Body" name="showBody" />
          <USwitch v-model="preferencesState.showWorkouts" label="Workouts" aria-label="Workouts" name="showWorkouts" />
          <USwitch
            v-model="preferencesState.showNutrition"
            label="Nutrition"
            aria-label="Nutrition"
            name="showNutrition"
          />
        </fieldset>

        <UButton type="submit" label="Save changes" :loading="preferencesLoading" class="w-fit" />
      </UForm>
    </UPageCard>
  </div>
</template>
