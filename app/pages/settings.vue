<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const links = [[
  {
    label: 'Profile',
    icon: 'i-lucide-user',
    to: '/settings/profile'
  },
  {
    label: 'Security',
    icon: 'i-lucide-lock',
    to: '/settings/security'
  }
]] satisfies NavigationMenuItem[][]
</script>

<template>
  <UDashboardPanel id="settings" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="Settings">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full lg:max-w-2xl mx-auto">
        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>
