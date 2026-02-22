<script setup lang="ts">
const { user, clear: clearSession } = useUserSession()
const { data: providers, refresh } = await useFetch('/api/auth/providers')
const toast = useToast()

const hasCredentials = computed(() => providers.value?.some((p) => p.provider === 'credentials') ?? false)

const showDeleteModal = ref(false)
const deleting = ref(false)

async function deleteAccount() {
  deleting.value = true
  try {
    await $fetch(`/api/users/${user.value!.id}`, { method: 'DELETE' })
    await clearSession()
    await navigateTo('/auth/login')
  } catch (error: unknown) {
    const message =
      error instanceof Error && 'data' in error
        ? (error as { data?: { statusMessage?: string } }).data?.statusMessage
        : undefined
    toast.add({
      title: 'Failed to delete account',
      description: message || 'Could not delete account',
      color: 'error'
    })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12">
    <UPageCard
      title="Password"
      description="Change your password or set one if you signed up with a social provider."
      variant="subtle"
    >
      <SettingsPasswordForm :has-credentials="hasCredentials" />
    </UPageCard>

    <UPageCard title="Linked Accounts" description="Manage your connected authentication providers." variant="subtle">
      <SettingsProviderList :linked-providers="providers ?? []" @unlinked="refresh()" />
    </UPageCard>

    <UPageCard
      title="Account"
      description="No longer want to use our service? You can delete your account here. This action is not reversible. All information related to this account will be deleted permanently."
      class="bg-linear-to-tl from-error/10 from-5% to-default"
    >
      <template #footer>
        <UButton label="Delete account" color="error" @click="showDeleteModal = true" />
      </template>
    </UPageCard>

    <UModal
      v-model:open="showDeleteModal"
      title="Delete account"
      description="Are you sure you want to delete your account? All of your data will be permanently removed. This action cannot be undone."
    >
      <template #body>
        <p class="text-sm text-muted">
          If you proceed, your account and all associated data will be deleted immediately.
        </p>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="outline" @click="showDeleteModal = false" />
          <UButton label="Delete account" color="error" :loading="deleting" @click="deleteAccount" />
        </div>
      </template>
    </UModal>
  </div>
</template>
