<script setup lang="ts">
const { data: containers, refresh: refreshContainers } = useFetch('/api/nutrition/meal-containers?includeArchived=1')
const { data: profiles, refresh: refreshProfiles } = useFetch('/api/nutrition/goal-profiles')
const { data: catalog, refresh: refreshCatalog } = useFetch('/api/nutrition/nutrients')
const { tracked, refresh: refreshTracked } = useTrackedNutrients()

async function onTrackedChanged() {
  await Promise.all([refreshTracked(), refreshCatalog()])
}
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12">
    <UPageCard
      title="Meal Containers"
      description="Rename, reorder, or archive the containers used to organize your diary."
      variant="subtle"
    >
      <SettingsNutritionContainers :containers="containers ?? []" @changed="refreshContainers" />
    </UPageCard>

    <UPageCard
      title="Goal Profiles"
      description="Define nutrient targets and choose which profile applies by default."
      variant="subtle"
    >
      <SettingsNutritionGoals :profiles="profiles ?? []" :catalog="catalog ?? []" :tracked="tracked ?? []" @changed="refreshProfiles" />
    </UPageCard>

    <UPageCard
      title="Tracked Nutrients"
      description="Choose which nutrients appear on your day view and rolling summary."
      variant="subtle"
    >
      <SettingsNutritionTracked :catalog="catalog ?? []" :tracked="tracked ?? []" @changed="onTrackedChanged" />
    </UPageCard>

    <UPageCard
      title="Import from My Macros+"
      description="Upload daily export .txt files to bring your logged meals into the diary."
      variant="subtle"
    >
      <SettingsNutritionImport @imported="refreshContainers" />
    </UPageCard>
  </div>
</template>
