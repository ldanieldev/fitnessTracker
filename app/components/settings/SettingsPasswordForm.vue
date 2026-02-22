<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const props = defineProps<{
  hasCredentials: boolean
}>()

const toast = useToast()

const schemaWithCurrent = z
  .object({
    currentPassword: z.string({ message: 'Current password is required' }).min(1, 'Current password is required'),
    newPassword: z.string({ message: 'New password is required' }).min(8, 'Must be at least 8 characters'),
    confirmPassword: z.string({ message: 'Confirm your password' }).min(8, 'Must be at least 8 characters')
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })

const schemaWithoutCurrent = z
  .object({
    newPassword: z.string({ message: 'New password is required' }).min(8, 'Must be at least 8 characters'),
    confirmPassword: z.string({ message: 'Confirm your password' }).min(8, 'Must be at least 8 characters')
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })

const schema = computed(() => props.hasCredentials ? schemaWithCurrent : schemaWithoutCurrent)

type SchemaWithCurrent = z.input<typeof schemaWithCurrent>
type SchemaWithoutCurrent = z.input<typeof schemaWithoutCurrent>

const state = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const loading = ref(false)

async function onSubmit(payload: FormSubmitEvent<SchemaWithCurrent | SchemaWithoutCurrent>) {
  loading.value = true
  try {
    await $fetch('/api/auth/password', {
      method: 'PUT',
      body: {
        currentPassword: 'currentPassword' in payload.data ? payload.data.currentPassword : undefined,
        newPassword: payload.data.newPassword
      }
    })
    toast.add({
      title: props.hasCredentials ? 'Password changed' : 'Password set',
      color: 'success'
    })
    state.currentPassword = ''
    state.newPassword = ''
    state.confirmPassword = ''
  } catch (error: unknown) {
    const message = error instanceof Error && 'data' in error
      ? (error as { data?: { statusMessage?: string } }).data?.statusMessage
      : undefined
    toast.add({
      title: 'Failed',
      description: message || 'Could not update password',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="flex flex-col gap-4 max-w-xs" @submit="onSubmit">
    <UFormField v-if="hasCredentials" label="Current Password" name="currentPassword" required>
      <UInput v-model="state.currentPassword" type="password" class="w-full" />
    </UFormField>

    <UFormField label="New Password" name="newPassword" required>
      <UInput v-model="state.newPassword" type="password" class="w-full" />
    </UFormField>

    <UFormField label="Confirm Password" name="confirmPassword" required>
      <UInput v-model="state.confirmPassword" type="password" class="w-full" />
    </UFormField>

    <UButton type="submit" :label="hasCredentials ? 'Change password' : 'Set password'" :loading="loading" class="w-fit" />
  </UForm>
</template>
