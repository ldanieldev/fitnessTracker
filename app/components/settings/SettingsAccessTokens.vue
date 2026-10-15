<script setup lang="ts">
import { errorMessage } from '~/utils/apiError'
import { shiftDate, todayDate } from '~~/shared/utils/nutritionSummary'

interface TokenRow {
  id: number
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

const toast = useToast()
const origin = useRequestURL().origin

const { data: tokens, refresh } = await useFetch<TokenRow[]>('/api/tokens', { key: 'access-tokens' })

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const name = ref('')
const creating = ref(false)
const revealed = ref<{ id: number; token: string; from: string; to: string } | null>(null)

const curl = computed(() => {
  if (!revealed.value) return ''
  const { token, from, to } = revealed.value
  return `curl -H "Authorization: Bearer ${token}" \\\n  "${origin}/api/export?from=${from}&to=${to}"`
})

async function create() {
  const trimmed = name.value.trim()
  if (!trimmed) return
  creating.value = true
  try {
    const result = await apiFetch<{ token: string; row: { id: number } }>('/api/tokens', {
      method: 'POST',
      body: { name: trimmed }
    })
    name.value = ''
    const to = todayDate()
    revealed.value = { id: result.row.id, token: result.token, from: shiftDate(to, -6), to }
    await refresh()
  } catch (error: unknown) {
    toast.add({ title: 'Create failed', description: errorMessage(error, 'Could not create token'), color: 'error' })
  } finally {
    creating.value = false
  }
}

async function copy() {
  if (!revealed.value) return
  try {
    await navigator.clipboard.writeText(revealed.value.token)
    toast.add({ title: 'Copied', color: 'success' })
  } catch {
    toast.add({ title: 'Copy failed', description: 'Select the token and copy it by hand', color: 'error' })
  }
}

const revokeTarget = ref<TokenRow | null>(null)
const revokeOpen = computed({
  get: () => revokeTarget.value !== null,
  set: (value: boolean) => {
    if (!value) revokeTarget.value = null
  }
})

async function confirmRevoke() {
  const target = revokeTarget.value
  if (!target) return
  try {
    await apiFetch(`/api/tokens/${target.id}`, { method: 'DELETE' })
    if (revealed.value?.id === target.id) revealed.value = null
  } catch (error: unknown) {
    toast.add({ title: 'Revoke failed', description: errorMessage(error, 'Could not revoke token'), color: 'error' })
  } finally {
    revokeTarget.value = null
    await refresh()
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 min-w-0">
    <p class="text-sm text-muted">
      A token can read and change everything you can, except your login, password, linked accounts and tokens. Settings
      it changes show in an open browser after a refresh.
    </p>

    <div
      v-if="revealed"
      class="flex flex-col gap-3 min-w-0 rounded-md border border-default p-3"
      data-test="token-reveal"
    >
      <div class="flex items-center gap-2 min-w-0">
        <UInput
          :model-value="revealed.token"
          readonly
          aria-label="New access token"
          class="flex-1 min-w-0"
          :ui="{ base: 'font-mono' }"
          data-test="token-secret"
        />
        <UButton
          icon="i-lucide-copy"
          size="sm"
          variant="soft"
          aria-label="Copy token"
          data-test="token-copy"
          @click="copy"
        />
      </div>
      <p class="text-sm text-muted">Copy it now. You won't see it again.</p>
      <pre
        class="max-w-full overflow-x-auto rounded-md bg-elevated p-2 text-xs font-mono"
        data-test="token-curl"
      >{{ curl }}</pre>
      <UButton
        label="Done"
        color="neutral"
        variant="outline"
        class="self-start"
        data-test="token-done"
        @click="revealed = null"
      />
    </div>

    <p v-if="!tokens?.length" class="text-sm text-dimmed" data-test="tokens-empty">No access tokens yet.</p>
    <ul v-else class="flex flex-col divide-y divide-default">
      <li
        v-for="token in tokens"
        :key="token.id"
        class="flex items-center gap-2 py-2 min-w-0"
        data-test="token-row"
      >
        <div class="flex-1 min-w-0">
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
          :aria-label="`Revoke ${token.name}`"
          @click="revokeTarget = token"
        />
      </li>
    </ul>

    <div class="flex items-end gap-2">
      <UFormField label="New token" class="flex-1 min-w-0">
        <UInput
          v-model="name"
          placeholder="Token name"
          maxlength="60"
          class="w-full"
          data-test="token-name"
          @keyup.enter="create"
        />
      </UFormField>
      <UButton label="Create" :loading="creating" :disabled="!name.trim()" data-test="token-create" @click="create" />
    </div>

    <AppSheet
      v-model:open="revokeOpen"
      title="Revoke token"
      :description="`Revoke ${revokeTarget?.name ?? ''}? Anything using it stops working.`"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="outline" @click="revokeTarget = null" />
          <UButton label="Revoke" color="error" data-test="confirm-revoke" @click="confirmRevoke" />
        </div>
      </template>
    </AppSheet>
  </div>
</template>
