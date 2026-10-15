<script setup lang="ts">
definePageMeta({
  middleware: () => {
    if (!useUserSession().user.value?.isAdmin) return navigateTo('/settings/profile')
  }
})

const tokensDescription = 'Every user\'s tokens. Revoking one stops anything using it.'
</script>

<template>
  <div class="flex flex-col gap-8 lg:gap-12">
    <section class="flex flex-col gap-3" aria-labelledby="admin-users-heading">
      <h2 id="admin-users-heading" class="text-xs font-medium text-dimmed uppercase">Users</h2>
      <UPageCard variant="subtle" :ui="{ container: 'min-w-0' }">
        <SettingsAdminUsers />
      </UPageCard>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="admin-tokens-heading">
      <h2 id="admin-tokens-heading" class="text-xs font-medium text-dimmed uppercase">Access tokens</h2>
      <UPageCard :description="tokensDescription" variant="subtle" :ui="{ container: 'min-w-0' }">
        <SettingsAdminTokens />
      </UPageCard>
    </section>
  </div>
</template>
