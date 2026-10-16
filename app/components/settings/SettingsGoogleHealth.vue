<script setup lang="ts">
import type { GoogleHealthStatus, SyncResult } from '~~/shared/types/googleHealth'
import { errorMessage } from '~/utils/apiError'

const toast = useToast()
const route = useRoute()
const router = useRouter()

const { data: status, refresh } = await useFetch<GoogleHealthStatus>('/api/integrations/google-health', {
  key: 'google-health'
})
const conn = computed(() => status.value?.connection ?? null)
const syncing = ref(false)
const saving = reactive({ syncSteps: false, pushWeight: false })
const missingScopes = computed(() => {
  const granted = conn.value?.granted
  if (!granted) return []
  return [
    ...(granted.sleep ? [] : ['Sleep not allowed. Reconnect to grant it.']),
    ...(granted.metrics ? [] : ['HRV and resting HR not allowed. Reconnect to grant it.'])
  ]
})
const scopeMissing = computed(() => {
  const granted = conn.value?.granted
  return Boolean(granted && Object.values(granted).some((allowed) => !allowed))
})
const disconnectOpen = ref(false)
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

onMounted(() => {
  const outcome = route.query.googleHealth
  if (outcome === 'connected') {
    toast.add({ title: 'Google Health connected', description: 'Your history is syncing now.', color: 'success' })
  }
  if (outcome === 'error') {
    toast.add({ title: 'Google Health not connected', description: 'Try again.', color: 'error' })
  }
  if (outcome) router.replace({ query: { ...route.query, googleHealth: undefined } })
})

function summary(result: Extract<SyncResult, { outcome: 'ok' }>) {
  const { hrv, restingHr, sleep, steps } = result.counts
  const parts = [`${hrv} HRV`, `${restingHr} resting HR`, `${sleep} sleep`]
  if (conn.value?.syncSteps) parts.push(`${steps} steps`)
  return `Synced: ${parts.join(', ')}`
}

async function syncNow() {
  syncing.value = true
  try {
    const result = await apiFetch<SyncResult>('/api/integrations/google-health/sync', { method: 'POST' })
    if (result.outcome === 'ok') {
      toast.add({
        title: summary(result),
        description: result.errors.join('; ') || undefined,
        color: result.errors.length ? 'warning' : 'success'
      })
    } else if (result.outcome === 'reconnect_required') {
      toast.add({ title: 'Reconnect Google Health', color: 'warning' })
    }
  } catch (error: unknown) {
    toast.add({ title: 'Sync failed', description: errorMessage(error, 'Could not sync'), color: 'error' })
  } finally {
    syncing.value = false
    await refresh()
  }
}

async function toggle(field: 'syncSteps' | 'pushWeight', value: boolean) {
  saving[field] = true
  try {
    status.value = await apiFetch<GoogleHealthStatus>('/api/integrations/google-health', {
      method: 'PATCH',
      body: { [field]: value }
    })
  } catch (error: unknown) {
    toast.add({ title: 'Save failed', description: errorMessage(error, 'Could not save'), color: 'error' })
    await refresh()
  } finally {
    saving[field] = false
  }
}

async function disconnect() {
  try {
    await apiFetch('/api/integrations/google-health', { method: 'DELETE' })
  } catch (error: unknown) {
    toast.add({
      title: 'Disconnect failed',
      description: errorMessage(error, 'Could not disconnect'),
      color: 'error'
    })
  } finally {
    disconnectOpen.value = false
    await refresh()
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 min-w-0" data-test="google-health">
    <p v-if="!status?.available" class="text-sm text-muted">Google Health isn't set up on this server.</p>

    <template v-else-if="!conn">
      <p class="text-sm text-muted">
        Sync HRV, resting heart rate and sleep from your Fitbit or Pixel Watch twice a day. Steps and weigh-ins are
        optional.
      </p>
      <UButton
        label="Connect Google Health"
        icon="i-lucide-link"
        href="/api/integrations/google-health/connect"
        external
        class="self-start"
      />
    </template>

    <template v-else>
      <UAlert
        v-if="conn.status === 'reconnect_required'"
        color="warning"
        variant="subtle"
        title="Google Health needs to be reconnected"
        description="Access was revoked or expired. Syncing is paused until you reconnect."
      >
        <template #actions>
          <UButton label="Reconnect" href="/api/integrations/google-health/connect" external size="sm" />
        </template>
      </UAlert>

      <div class="text-sm">
        <p class="text-muted">Connected as</p>
        <p class="break-all" data-test="google-health-email">{{ conn.email }}</p>
        <ClientOnly>
          <p class="text-dimmed">
            Last synced {{ conn.lastSyncedAt ? dateTimeFormat.format(new Date(conn.lastSyncedAt)) : 'never' }}
          </p>
          <template #fallback>
            <p class="text-dimmed" aria-hidden="true">&nbsp;</p>
          </template>
        </ClientOnly>
        <p v-if="conn.lastError" class="text-warning break-words" data-test="google-health-error">
          {{ conn.lastError }}
        </p>
        <p v-for="line in missingScopes" :key="line" class="text-warning">{{ line }}</p>
      </div>

      <UButton
        v-if="scopeMissing && conn.status === 'active'"
        label="Reconnect"
        icon="i-lucide-link"
        href="/api/integrations/google-health/connect"
        external
        color="neutral"
        variant="outline"
        size="sm"
        class="self-start"
      />

      <UButton
        label="Sync now"
        icon="i-lucide-refresh-cw"
        :loading="syncing"
        :disabled="conn.status !== 'active'"
        class="self-start"
        @click="syncNow"
      />

      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium">Import steps from Google</p>
            <p v-if="!conn.granted.activity" class="text-xs text-warning">Not allowed. Reconnect to grant it.</p>
          </div>
          <USwitch
            :model-value="conn.syncSteps"
            :disabled="!conn.granted.activity || saving.syncSteps"
            aria-label="Import steps from Google"
            @update:model-value="toggle('syncSteps', $event)"
          />
        </div>
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium">Send my weigh-ins to Google</p>
            <p v-if="!conn.granted.weightWrite" class="text-xs text-warning">Not allowed. Reconnect to grant it.</p>
          </div>
          <USwitch
            :model-value="conn.pushWeight"
            :disabled="!conn.granted.weightWrite || saving.pushWeight"
            aria-label="Send my weigh-ins to Google"
            @update:model-value="toggle('pushWeight', $event)"
          />
        </div>
      </div>

      <UButton
        label="Disconnect"
        color="neutral"
        variant="outline"
        class="self-start"
        @click="disconnectOpen = true"
      />

      <AppSheet
        v-model:open="disconnectOpen"
        title="Disconnect Google Health"
        description="Syncing stops and Google's access is revoked. Data already synced stays."
      >
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton label="Cancel" color="neutral" variant="outline" @click="disconnectOpen = false" />
            <UButton label="Disconnect" color="error" @click="disconnect" />
          </div>
        </template>
      </AppSheet>
    </template>
  </div>
</template>
