<script setup lang="ts">
interface LinkedProvider {
  provider: string
  providerAccountId: string
  createdAt: string
}

const props = defineProps<{
  linkedProviders: LinkedProvider[]
}>()

const emit = defineEmits<{
  unlinked: []
}>()

const toast = useToast()

const availableProviders = [
  { name: 'github', label: 'GitHub', icon: 'i-simple-icons-github', linkUrl: '/api/auth/github' },
  { name: 'google', label: 'Google', icon: 'i-simple-icons-google', linkUrl: '/api/auth/google' }
]

const unlinking = ref<string | null>(null)

function isLinked(provider: string) {
  return props.linkedProviders.some((p) => p.provider === provider)
}

const canUnlink = computed(() => props.linkedProviders.length > 1)

async function unlink(provider: string) {
  unlinking.value = provider
  try {
    await $fetch(`/api/auth/providers/${provider}`, { method: 'DELETE' })
    toast.add({
      title: `${provider} unlinked`,
      color: 'success'
    })
    emit('unlinked')
  } catch (error: unknown) {
    const message = error instanceof Error && 'data' in error
      ? (error as { data?: { statusMessage?: string } }).data?.statusMessage
      : undefined
    toast.add({
      title: 'Failed to unlink',
      description: message || 'Could not unlink provider',
      color: 'error'
    })
  } finally {
    unlinking.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
      <div
        v-for="provider in availableProviders"
        :key="provider.name"
        class="flex items-center justify-between p-3 rounded-lg border border-default"
      >
        <div class="flex items-center gap-3">
          <UIcon :name="provider.icon" class="size-5" />
          <span class="font-medium">{{ provider.label }}</span>
          <UBadge v-if="isLinked(provider.name)" color="success" variant="subtle" label="Connected" />
          <UBadge v-else color="neutral" variant="subtle" label="Not connected" />
        </div>

        <UButton
          v-if="isLinked(provider.name)"
          label="Unlink"
          color="error"
          variant="soft"
          size="sm"
          :disabled="!canUnlink"
          :loading="unlinking === provider.name"
          @click="unlink(provider.name)"
        />
        <UButton
          v-else
          :label="`Link ${provider.label}`"
          variant="soft"
          size="sm"
          :to="provider.linkUrl"
          external
        />
    </div>
  </div>
</template>
