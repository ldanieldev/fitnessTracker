<script setup lang="ts">
import type { GoalOverview } from '~~/shared/types/body'

const goalsFetch = useBodyFetch<GoalOverview[]>(BODY_KEYS.goals, '/api/body/goals')
await goalsFetch
const goals = computed(() => goalsFetch.data.value ?? [])
const today = useTodayOrNow()

const editing = ref<GoalOverview | null>(null)
const sheetOpen = ref(false)

function openEdit(item: GoalOverview) {
  editing.value = item
  sheetOpen.value = true
}
</script>

<template>
  <UDashboardPanel id="body-goals">
    <template #header>
      <UDashboardNavbar title="Goals">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <div class="grid gap-3 sm:grid-cols-2">
          <BodyGoalCard v-for="item in goals" :key="item.type.id" :item="item" :today="today" @edit="openEdit(item)" />
        </div>
        <p v-if="goals.length === 0" class="text-sm text-dimmed" data-test="goals-empty">No goals yet — open a measurement and tap its Goal tile</p>
      </div>
      <BodyGoalSheet v-model:open="sheetOpen" :type="editing?.type ?? null" :goal="editing?.goal ?? null" :latest="editing?.latest?.value ?? null" />
    </template>
  </UDashboardPanel>
</template>
