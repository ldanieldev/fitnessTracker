<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { loggedIn } = useUserSession()

watch(loggedIn, () => {
  if (!loggedIn.value) {
    navigateTo('/auth/login')
  }
})

const open = ref(false)
const { appName } = useRuntimeConfig().public

const close = () => {
  open.value = false
}

const links = [
  [
    {
      label: 'Dashboard',
      icon: 'i-lucide-layout-dashboard',
      to: '/',
      onSelect: close
    },
    {
      label: 'Tracking',
      icon: 'i-lucide-dumbbell',
      defaultOpen: true,
      type: 'trigger' as const,
      children: [
        {
          label: 'Log Workout',
          to: '/workouts/log',
          onSelect: close
        },
        {
          label: 'Workout History',
          // to: '/workouts/history',
          onSelect: close
        },
        {
          label: 'Exercises',
          // to: '/exercises',
          onSelect: close
        }
      ]
    },
    {
      label: 'Progress & Goals',
      icon: 'i-lucide-trending-up',
      defaultOpen: true,
      type: 'trigger' as const,
      children: [
        {
          label: 'Progress',
          // to: '/progress',
          onSelect: close
        },
        {
          label: 'Body Metrics',
          // to: '/body-metrics',
          onSelect: close
        },
        {
          label: 'Goals',
          // to: '/goals',
          onSelect: close
        }
      ]
    },
    {
      label: 'Planning',
      icon: 'i-lucide-clipboard-list',
      defaultOpen: true,
      type: 'trigger' as const,
      children: [
        {
          label: 'Programs',
          // to: '/programs',
          onSelect: close
        },
        {
          label: 'Calendar',
          // to: '/calendar',
          onSelect: close
        },
        {
          label: 'Timer',
          // to: '/timer',
          onSelect: close
        }
      ]
    }
  ]
] satisfies NavigationMenuItem[][]
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <UButton
          color="neutral"
          variant="ghost"
          block
          :square="collapsed"
          class="data-[state=open]:bg-elevated"
          :class="[!collapsed && 'py-2']"
          :ui="{
            trailingIcon: 'text-dimmed'
          }"
          to="/"
          :avatar="{
            src: 'https://github.com/nuxt.png',
            alt: 'uxt'
          }"
          >{{ collapsed ? undefined : appName }}</UButton
        >
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu :collapsed="collapsed" :items="links[0]" orientation="vertical" tooltip popover />

        <UNavigationMenu :collapsed="collapsed" :items="links[1]" orientation="vertical" tooltip class="mt-auto" />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>
    <slot />
  </UDashboardGroup>
</template>
