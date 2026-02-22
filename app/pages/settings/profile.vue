<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const { user, fetch: fetchSession } = useUserSession()
const toast = useToast()

const schema = z.object({
  name: z.string({ message: 'Name is required' }).min(1, 'Name is required'),
  email: z.string({ message: 'Email is required' }).email('Invalid email'),
  age: z.coerce
    .number({ message: 'Age is required' })
    .min(13, 'Must be at least 13 years old')
    .max(120, 'Invalid age'),
  sex: z.enum(['m', 'f'], { message: 'Sex is required' }),
  avatarUrl: z.string().url('Invalid URL').optional().or(z.literal(''))
})

type Schema = z.input<typeof schema>

const state = reactive<Partial<Schema>>({
  name: user.value?.name ?? '',
  email: user.value?.email ?? '',
  age: user.value?.age ?? undefined,
  sex: (user.value?.sex as 'm' | 'f') ?? undefined,
  avatarUrl: user.value?.avatar_url ?? ''
})

const loading = ref(false)

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch(`/api/users/${user.value!.id}`, {
      method: 'PUT',
      body: payload.data
    })
    await fetchSession()
    toast.add({
      title: 'Profile updated',
      color: 'success'
    })
  } catch (error: unknown) {
    const message = error instanceof Error && 'data' in error
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
  <UPageCard
    title="Profile"
    description="Update your personal information."
    variant="subtle"
  >
    <UForm :schema="schema" :state="state" class="flex flex-col gap-4 max-w-xs" @submit="onSubmit">
      <div class="flex items-center gap-4">
        <UAvatar
          :src="state.avatarUrl || undefined"
          :alt="state.name"
          size="lg"
        />
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
        <UInput v-model="(state.age as string | number)" type="number" placeholder="Enter your age" class="w-full" />
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

      <UButton type="submit" label="Save changes" :loading="loading" class="w-fit" />
    </UForm>
  </UPageCard>
</template>
