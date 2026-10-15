<script setup lang="ts">
import { errorMessage } from '~/utils/apiError'

interface AdminToken {
  id: number
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  ownerEmail: string
}

const toast = useToast()
const {
  data: tokens,
  refresh,
  error: loadError
} = await useFetch<AdminToken[]>('/api/admin/tokens', { key: 'admin-tokens' })

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const revokeTarget = ref<AdminToken | null>(null)
const busy = ref(false)
const revokeShown = ref<AdminToken | null>(null)
watch(revokeTarget, (value) => {
  if (value) revokeShown.value = value
})
const revokeOpen = computed({
  get: () => revokeTarget.value !== null,
  set: (value: boolean) => {
    if (!value) revokeTarget.value = null
  }
})

const revokeDescription = computed(
  () =>
    `Revoke ${revokeShown.value?.name ?? ''} (${revokeShown.value?.ownerEmail ?? ''})? ` +
    'Anything using it stops working.'
)

async function confirmRevoke() {
  const target = revokeTarget.value
  if (!target || busy.value) return
  busy.value = true
  try {
    await apiFetch(`/api/admin/tokens/${target.id}`, { method: 'DELETE' })
  } catch (error: unknown) {
    toast.add({ title: 'Revoke failed', description: errorMessage(error, 'Could not revoke token'), color: 'error' })
  } finally {
    revokeTarget.value = null
    await refresh()
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 min-w-0">
    <p v-if="loadError" class="text-sm text-error" data-test="admin-tokens-error">Could not load tokens.</p>
    <p v-else-if="!tokens?.length" class="text-sm text-dimmed" data-test="admin-tokens-empty">No access tokens.</p>
    <ul v-else class="flex flex-col divide-y divide-default">
      <li
        v-for="token in tokens"
        :key="token.id"
        class="flex items-start gap-2 py-2 min-w-0"
        data-test="admin-token-row"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm text-muted break-all">{{ token.ownerEmail }}</p>
          <p class="text-sm font-medium break-words">{{ token.name }}</p>
          <p class="text-xs font-mono text-muted">mfj_{{ token.prefix }}…</p>
          <ClientOnly>
            <p class="text-xs text-dimmed">
              Created {{ dateFormat.format(new Date(token.createdAt)) }} · Last used
              {{ token.lastUsedAt ? dateTimeFormat.format(new Date(token.lastUsedAt)) : 'Never' }}
            </p>
          </ClientOnly>
        </div>
        <UButton
          icon="i-lucide-trash-2"
          size="sm"
          variant="ghost"
          color="neutral"
          :aria-label="`Revoke ${token.name} for ${token.ownerEmail}`"
          @click="revokeTarget = token"
        />
      </li>
    </ul>

    <AppSheet
      v-model:open="revokeOpen"
      title="Revoke token"
      :description="revokeDescription"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="outline" @click="revokeTarget = null" />
          <UButton
            label="Revoke"
            color="error"
            :loading="busy"
            data-test="admin-revoke-confirm"
            @click="confirmRevoke"
          />
        </div>
      </template>
    </AppSheet>
  </div>
</template>
