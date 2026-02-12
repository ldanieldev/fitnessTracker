<script setup lang="ts">
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'
import * as z from 'zod'

const { fetch: fetchSession } = useUserSession()
const toast = useToast()

const fields: AuthFormField[] = [
  {
    name: 'email',
    type: 'email',
    label: 'Email',
    placeholder: 'Enter your email',
    required: true
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
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

const schema = z.object({
  email: z.string({ message: 'Email is required' }).email('Invalid email'),
  password: z.string({ message: 'Password is required' }).min(8, 'Must be at least 8 characters')
})

type Schema = z.output<typeof schema>

const loading = ref(false)

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: payload.data
    })
    await fetchSession()
    await navigateTo('/')
  } catch (error: unknown) {
    const message = error instanceof Error && 'data' in error
      ? (error as { data?: { statusMessage?: string } }).data?.statusMessage
      : undefined
    toast.add({
      title: 'Login failed',
      description: message || 'Invalid email or password',
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
        title="Login"
        description="Enter your credentials to access your account."
        icon="i-lucide-user"
        :fields="fields"
        :providers="providers"
        :loading="loading"
        @submit="onSubmit"
      >
        <template #footer>
          Don't have an account?
          <ULink to="/auth/register" class="text-primary font-medium"> Register </ULink>
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
