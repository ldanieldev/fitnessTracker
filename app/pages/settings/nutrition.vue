<script setup lang="ts">
interface Container {
  id: number
  name: string
  sortOrder: number
  isArchived: boolean
}

interface ProfileTarget {
  nutrient: string
  amount: number
  direction: 'min' | 'max' | 'target'
  ratioPercent: number | null
}

interface Profile {
  id: number
  name: string
  inputMode: 'grams' | 'ratio'
  calories: number | null
  isDefault: boolean
  targets: ProfileTarget[]
}

interface CatalogEntry {
  key: string
  name: string
  unit: string
  defaultDirection: 'min' | 'max' | 'target'
}

const { data: containers } = useNutritionFetch<Container[]>(NUTRITION_KEYS.containersAll, '/api/nutrition/meal-containers?includeArchived=1')
const { data: profiles } = useNutritionFetch<Profile[]>(NUTRITION_KEYS.profiles, '/api/nutrition/goal-profiles')
const { data: catalog } = useNutritionFetch<CatalogEntry[]>(NUTRITION_KEYS.catalog, '/api/nutrition/nutrients')
const { tracked } = useTrackedNutrients()
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12">
    <UPageCard
      title="Meal Containers"
      description="Rename, reorder, or archive the containers used to organize your diary."
      variant="subtle"
    >
      <SettingsNutritionContainers :containers="containers ?? []" />
    </UPageCard>

    <UPageCard
      title="Goal Profiles"
      description="Define nutrient targets and choose which profile applies by default."
      variant="subtle"
    >
      <SettingsNutritionGoals :profiles="profiles ?? []" :catalog="catalog ?? []" :tracked="tracked ?? []" />
    </UPageCard>

    <UPageCard
      title="Tracked Nutrients"
      description="Choose which nutrients appear on your day view and rolling summary."
      variant="subtle"
    >
      <SettingsNutritionTracked :catalog="catalog ?? []" :tracked="tracked ?? []" />
    </UPageCard>

    <UPageCard
      title="Import from My Macros+"
      description="Upload daily export .txt files to bring your logged meals into the diary."
      variant="subtle"
    >
      <SettingsNutritionImport />
    </UPageCard>
  </div>
</template>
