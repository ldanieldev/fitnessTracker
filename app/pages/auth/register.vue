<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const { fetch: fetchSession } = useUserSession()
const toast = useToast()

const fields = [
  {
    name: 'name',
    type: 'text' as const,
    label: 'Name',
    placeholder: 'Enter your full name',
    required: true
  },
  {
    name: 'email',
    type: 'email' as const,
    label: 'Email',
    placeholder: 'Enter your email',
    required: true
  },
  {
    name: 'age',
    type: 'number' as const,
    label: 'Age',
    placeholder: 'Enter your age',
    required: true
  },
  {
    name: 'sex',
    type: 'select' as const,
    label: 'Sex',
    placeholder: 'Select your sex',
    required: true,
    items: [
      { label: 'Male', value: 'm' },
      { label: 'Female', value: 'f' }
    ]
  },
  {
    name: 'password',
    type: 'password' as const,
    label: 'Password',
    placeholder: 'Create a password',
    required: true
  },
  {
    name: 'confirmPassword',
    type: 'password' as const,
    label: 'Confirm Password',
    placeholder: 'Confirm your password',
    required: true
  }
]

const providers = [
  {
    label: 'Google',
    icon: 'i-simple-icons-google',
    to: '/api/auth/google',
    external: true
  },
  {
    label: 'GitHub',
    icon: 'i-simple-icons-github',
    to: '/api/auth/github',
    external: true
  }
]

const schema = z
  .object({
    name: z.string({ message: 'Name is required' }).min(1, 'Name is required'),
    email: z.string({ message: 'Email is required' }).email('Invalid email'),
    age: z.coerce
      .number({ message: 'Age is required' })
      .min(13, 'Must be at least 13 years old')
      .max(120, 'Invalid age'),
    sex: z.enum(['m', 'f'], { message: 'Sex is required' }),
    password: z.string({ message: 'Password is required' }).min(8, 'Must be at least 8 characters'),
    confirmPassword: z.string({ message: 'Confirm your password' }).min(8, 'Must be at least 8 characters')
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })

type Schema = z.input<typeof schema>

const loading = ref(false)

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const { confirmPassword, ...data } = payload.data
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: data
    })
    await fetchSession()
    await navigateTo('/')
  } catch (error: unknown) {
    const message = error instanceof Error && 'data' in error
      ? (error as { data?: { statusMessage?: string } }).data?.statusMessage
      : undefined
    toast.add({
      title: 'Registration failed',
      description: message || 'Registration failed',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-md p-4">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :schema="schema"
        title="Create an account"
        description="Enter your details to get started."
        icon="i-lucide-user-plus"
        :fields="fields"
        :providers="providers"
        :loading="loading"
        @submit="onSubmit"
      >
        <template #footer>
          Already have an account?
          <ULink to="/auth/login" class="text-primary font-medium"> Login </ULink>
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
