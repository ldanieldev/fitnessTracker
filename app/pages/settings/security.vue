<script setup lang="ts">
import { normalizeEmail } from '#shared/utils/email'

const { user, clear: clearSession } = useUserSession()
const { data: providers, refresh } = await useFetch('/api/auth/providers')
const toast = useToast()
const accountDescription =
  'No longer want to use our service? You can delete your account here. This action is not reversible. ' +
  'All information related to this account will be deleted permanently.'
const deleteDescription =
  'This permanently deletes your account and all of its data. It cannot be undone. Type your email to confirm.'

const hasCredentials = computed(() => providers.value?.some((p) => p.provider === 'credentials') ?? false)

const showDeleteModal = ref(false)
const deleting = ref(false)
const deleteEmail = ref('')
const deleteMatches = computed(
  () => !!user.value && normalizeEmail(deleteEmail.value) === normalizeEmail(user.value.email)
)

function openDeleteModal() {
  deleteEmail.value = ''
  showDeleteModal.value = true
}

async function deleteAccount() {
  if (!deleteMatches.value || deleting.value) return
  deleting.value = true
  try {
    await apiFetch(`/api/users/${user.value!.id}`, { method: 'DELETE', body: { confirmEmail: deleteEmail.value } })
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
      :description="accountDescription"
      class="bg-linear-to-tl from-error/10 from-5% to-default"
    >
      <template #footer>
        <UButton label="Delete account" color="error" data-test="account-delete" @click="openDeleteModal" />
      </template>
    </UPageCard>

    <UModal
      v-model:open="showDeleteModal"
      title="Delete account"
      :description="deleteDescription"
    >
      <template #body>
        <UInput
          v-model="deleteEmail"
          :placeholder="user?.email"
          aria-label="Type your email to confirm"
          autocomplete="off"
          class="w-full"
          data-test="account-delete-email"
        />
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="outline" @click="showDeleteModal = false" />
          <UButton
            label="Delete account"
            color="error"
            :disabled="!deleteMatches"
            :loading="deleting"
            data-test="account-delete-confirm"
            @click="deleteAccount"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
