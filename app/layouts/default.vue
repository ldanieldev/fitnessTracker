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

const { energyLeft } = useTodaySummary()
const diaryBadge = computed(() => (loggedIn.value && energyLeft.value !== null ? String(Math.round(energyLeft.value)) : undefined))

const links = computed(() => [
  [
    {
      label: 'Dashboard',
      icon: 'i-lucide-layout-dashboard',
      to: '/',
      onSelect: close
    },
    {
      label: 'Body',
      icon: 'i-lucide-person-standing',
      defaultOpen: true,
      type: 'trigger' as const,
      children: [
        {
          label: 'Measurements',
          to: '/body',
          onSelect: close
        },
        {
          label: 'Progress',
          to: '/body/progress',
          onSelect: close
        },
        {
          label: 'Goals',
          to: '/body/goals',
          onSelect: close
        }
      ]
    },
    {
      label: 'Workouts',
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
        },
        {
          label: 'Programs',
          // to: '/programs',
          onSelect: close
        },
        {
          label: 'Timer',
          // to: '/timer',
          onSelect: close
        }
      ]
    },
    {
      label: 'Nutrition',
      icon: 'i-lucide-utensils',
      defaultOpen: true,
      type: 'trigger' as const,
      children: [
        { label: 'Diary', to: '/diary/today', badge: diaryBadge.value, onSelect: close },
        { label: 'Foods', to: '/nutrition/foods', onSelect: close },
        { label: 'Saved meals', to: '/nutrition/saved-meals', onSelect: close },
        { label: 'Recipes', to: '/nutrition/recipes', onSelect: close },
        { label: 'Summary', to: '/diary/summary', onSelect: close }
      ]
    }
  ]
] satisfies NavigationMenuItem[][])
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
        >
          <template #leading>
            <AppLogo class="size-12 shrink-0" />
          </template>
          {{ collapsed ? undefined : appName }}
        </UButton>
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
