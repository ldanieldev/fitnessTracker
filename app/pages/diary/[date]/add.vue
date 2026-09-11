<script setup lang="ts">
import NutritionFoodPicker from '~/components/nutrition/NutritionFoodPicker.vue'
import type { DiaryEntryInput } from '~/composables/useDiaryDay'

interface RecipeRow { id: number, name: string, servings: number, servingName: string, perServing: Record<string, number>, broken: boolean }
interface MealRow { id: number, name: string, itemCount: number, total: Record<string, number> }

const route = useRoute()
const date = computed(() => String(route.params.date))
const queryNumber = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

const { logEntries } = useDiaryDay(date)
const { data: containers } = await useFetch<Array<{ id: number, name: string }>>('/api/nutrition/meal-containers')
const { data: recipes, refresh: refreshRecipes } = await useFetch<RecipeRow[]>('/api/nutrition/recipes')
const { data: meals, refresh: refreshMeals } = await useFetch<MealRow[]>('/api/nutrition/saved-meals')

const tray = useAddTray()
const containerItems = useContainerItems(() => containers.value ?? [])
const containerId = ref<number | undefined>()
watch(containers, (list) => {
  if (containerId.value !== undefined || !list?.length) return
  const wanted = queryNumber(route.query.containerId)
  containerId.value = list.some((c) => c.id === wanted) ? wanted : list[0]!.id
}, { immediate: true })
const containerName = computed(() => containers.value?.find((c) => c.id === containerId.value)?.name ?? '')

const activeTab = ref<'foods' | 'recipes' | 'meals' | 'online'>('foods')
const tabItems = [
  { label: 'Foods', value: 'foods', slot: 'foods', test: 'local-tab' },
  { label: 'Recipes', value: 'recipes', slot: 'recipes', test: 'recipes-tab' },
  { label: 'Meals', value: 'meals', slot: 'meals', test: 'meals-tab' },
  { label: 'Online', value: 'online', slot: 'online', test: 'online-tab' }
]

const picker = ref<InstanceType<typeof NutritionFoodPicker>>()
const needsNutritionFoodId = ref<number | null>(null)

onMounted(async () => {
  const foodId = queryNumber(route.query.foodId)
  if (foodId === undefined) return
  await picker.value?.select(foodId)
  needsNutritionFoodId.value = route.query.needsNutrition === '1' ? foodId : null
})

watch(() => tray.state.foods.map((f) => f.foodId), (ids) => {
  if (needsNutritionFoodId.value !== null && !ids.includes(needsNutritionFoodId.value)) needsNutritionFoodId.value = null
})

async function onImported({ id, needsNutrition }: { id: number, needsNutrition: boolean }) {
  activeTab.value = 'foods'
  await nextTick()
  await picker.value?.select(id)
  needsNutritionFoodId.value = needsNutrition ? id : null
}

const trayItems = computed(() => [
  ...tray.state.foods.map((f) => ({ kind: 'food' as const, id: f.foodId, label: f.name, detail: `${f.quantity} ${f.unitLabel}` })),
  ...tray.state.recipes.map((r) => ({ kind: 'recipe' as const, id: r.recipeId, label: r.name, detail: `${r.servings} ${r.servingName}` })),
  ...tray.state.meals.map((m) => ({ kind: 'meal' as const, id: m.savedMealId, label: m.name, detail: 'saved meal' }))
])

async function submit() {
  if (containerId.value === undefined || !tray.ready.value) return
  const result = await logEntries(tray.toEntryInputs(containerId.value))
  if (result) {
    tray.clear()
    await navigateTo(`/diary/${date.value}`)
  } else {
    await Promise.all([refreshRecipes(), refreshMeals()])
  }
}

const quickAddOpen = ref(false)

async function onQuickAdd(input: DiaryEntryInput) {
  const result = await logEntries([input])
  if (result) {
    quickAddOpen.value = false
    await navigateTo(`/diary/${date.value}`)
  }
}
</script>

<template>
  <UDashboardPanel id="diary-add">
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #title>
          <span class="font-semibold">Add to</span>
        </template>
        <template #right>
          <USelect v-model="containerId" :items="containerItems" class="w-36" data-test="add-container" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-2xl mx-auto w-full pb-24">
        <UTabs v-model="activeTab" :items="tabItems" :unmount-on-hide="false" class="w-full">
          <template #default="{ item }">
            <span :data-test="item.test">{{ item.label }}</span>
          </template>

          <template #foods>
            <NutritionFoodPicker ref="picker" v-model="tray.state.foods" :needs-nutrition-food-id="needsNutritionFoodId">
              <template #actions>
                <div class="flex gap-2 overflow-x-auto">
                  <UButton icon="i-lucide-scan-barcode" label="Scan" size="sm" variant="soft" color="neutral" :to="`/diary/${date}/scan`" data-test="scan-button" />
                  <UButton icon="i-lucide-zap" label="Quick add" size="sm" variant="soft" color="neutral" data-test="toggle-quick-add" @click="quickAddOpen = true" />
                  <UButton icon="i-lucide-plus" label="New food" size="sm" variant="soft" color="neutral" :to="`/diary/${date}/foods/new`" />
                </div>
              </template>
            </NutritionFoodPicker>
          </template>

          <template #recipes>
            <NutritionAddRecipes
              :recipes="recipes ?? []"
              :selected="tray.state.recipes"
              @toggle="(recipe, on) => tray.toggleRecipe(recipe, on)"
              @servings="(id, n) => tray.setRecipeServings(id, n)"
            />
          </template>

          <template #meals>
            <NutritionAddMeals :meals="meals ?? []" :selected="tray.state.meals" @toggle="(meal, on) => tray.toggleMeal(meal, on)" />
          </template>

          <template #online>
            <NutritionOnlineSearch @imported="onImported" />
          </template>
        </UTabs>
      </div>

      <NutritionAddTray
        :count="tray.count.value"
        :ready="tray.ready.value"
        :container-name="containerName"
        :items="trayItems"
        @submit="submit"
        @remove="(kind, id) => tray.remove(kind, id)"
      />

      <NutritionSheet v-model:open="quickAddOpen" title="Quick add">
        <template #body>
          <NutritionQuickAddForm :containers="containers ?? []" @submit="onQuickAdd" />
        </template>
      </NutritionSheet>
    </template>
  </UDashboardPanel>
</template>
