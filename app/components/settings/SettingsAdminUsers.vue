<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { errorMessage } from '~/utils/apiError'

interface AdminUser {
  id: number
  name: string
  email: string
  createdAt: string
  isActive: boolean
  isAdmin: boolean
  providers: string[]
  tokenCount: number
  tokenLastUsedAt: string | null
}

const toast = useToast()
const {
  data: users,
  refresh,
  error: loadError
} = await useFetch<AdminUser[]>('/api/admin/users', { key: 'admin-users' })
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

const disableTarget = ref<AdminUser | null>(null)
const disableOpen = computed({
  get: () => disableTarget.value !== null,
  set: (value: boolean) => {
    if (!value) disableTarget.value = null
  }
})

const deleteTarget = ref<AdminUser | null>(null)
const busy = ref(false)
const disableShown = ref<AdminUser | null>(null)
const deleteShown = ref<AdminUser | null>(null)
watch(disableTarget, (value) => {
  if (value) disableShown.value = value
})
watch(deleteTarget, (value) => {
  if (value) deleteShown.value = value
})
const deleteEmail = ref('')
const deleteOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (value: boolean) => {
    if (!value) deleteTarget.value = null
  }
})
const disableDescription = computed(
  () =>
    `Disable ${disableShown.value?.email ?? ''}? They will be logged out everywhere and their tokens ` +
    'revoked. Their data is kept.'
)
const deleteDescription = computed(
  () =>
    `This permanently deletes ${deleteShown.value?.email ?? ''} and all of their data. ` +
    'Type their email to confirm.'
)
const deleteMatches = computed(() => deleteTarget.value !== null && deleteEmail.value === deleteTarget.value.email)

function menuFor(user: AdminUser): DropdownMenuItem[][] {
  return [
    [
      user.isActive
        ? {
            label: 'Disable',
            icon: 'i-lucide-user-x',
            testId: 'admin-toggle-active',
            onSelect: () => {
              disableTarget.value = user
            }
          }
        : {
            label: 'Enable',
            icon: 'i-lucide-user-check',
            testId: 'admin-toggle-active',
            onSelect: () => setActive(user, true)
          }
    ],
    [
      {
        label: 'Delete',
        icon: 'i-lucide-trash-2',
        color: 'error',
        testId: 'admin-delete',
        onSelect: () => {
          deleteEmail.value = ''
          deleteTarget.value = user
        }
      }
    ]
  ]
}

async function setActive(user: AdminUser, isActive: boolean) {
  if (busy.value) return
  busy.value = true
  try {
    await apiFetch(`/api/admin/users/${user.id}`, { method: 'PATCH', body: { isActive } })
  } catch (error: unknown) {
    toast.add({ title: 'Update failed', description: errorMessage(error, 'Could not update user'), color: 'error' })
  } finally {
    disableTarget.value = null
    await Promise.all([refresh(), refreshNuxtData('admin-tokens')])
    busy.value = false
  }
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target || !deleteMatches.value || busy.value) return
  busy.value = true
  try {
    await apiFetch(`/api/admin/users/${target.id}`, { method: 'DELETE' })
  } catch (error: unknown) {
    toast.add({ title: 'Delete failed', description: errorMessage(error, 'Could not delete user'), color: 'error' })
  } finally {
    deleteTarget.value = null
    await Promise.all([refresh(), refreshNuxtData('admin-tokens')])
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 min-w-0">
    <p v-if="loadError" class="text-sm text-error" data-test="admin-users-error">Could not load users.</p>
    <ul v-else class="flex flex-col divide-y divide-default">
      <li
        v-for="user in users"
        :key="user.id"
        class="flex items-start gap-2 py-2 min-w-0"
        data-test="admin-user-row"
      >
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p class="text-sm font-medium break-words">{{ user.name }}</p>
            <UBadge v-if="user.isAdmin" label="Admin" color="neutral" variant="subtle" size="sm" />
            <UBadge v-if="!user.isActive" label="Disabled" color="error" variant="subtle" size="sm" />
          </div>
          <p class="text-sm text-muted break-all">{{ user.email }}</p>
          <p class="text-xs text-dimmed">
            {{ user.providers.join(', ') }}
            <ClientOnly>· Joined {{ dateFormat.format(new Date(user.createdAt)) }}</ClientOnly>
          </p>
        </div>
        <AppMenuButton
          v-if="!user.isAdmin"
          :items="menuFor(user)"
          :label="`Actions for ${user.email}`"
          test-id="admin-user-menu"
        />
      </li>
    </ul>

    <AppSheet
      v-model:open="disableOpen"
      title="Disable user"
      :description="disableDescription"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="outline" @click="disableTarget = null" />
          <UButton
            label="Disable"
            color="error"
            :loading="busy"
            data-test="admin-disable-confirm"
            @click="disableTarget && setActive(disableTarget, false)"
          />
        </div>
      </template>
    </AppSheet>

    <AppSheet
      v-model:open="deleteOpen"
      title="Delete user"
      :description="deleteDescription"
    >
      <template #body>
        <div data-test="admin-delete-sheet">
          <UInput
            v-model="deleteEmail"
            :placeholder="deleteShown?.email"
            aria-label="Type the email to confirm"
            autocomplete="off"
            class="w-full"
            data-test="admin-delete-email"
          />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="outline" @click="deleteTarget = null" />
          <UButton
            label="Delete"
            color="error"
            :disabled="!deleteMatches"
            :loading="busy"
            data-test="admin-delete-confirm"
            @click="confirmDelete"
          />
        </div>
      </template>
    </AppSheet>
  </div>
</template>
