<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
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
const { data: containers } = await useNutritionFetch<Array<{ id: number, name: string }>>(NUTRITION_KEYS.containers, '/api/nutrition/meal-containers')
const { data: recipes, refresh: refreshRecipes } = await useNutritionFetch<RecipeRow[]>(NUTRITION_KEYS.recipes, '/api/nutrition/recipes')
const { data: meals, refresh: refreshMeals } = await useNutritionFetch<MealRow[]>(NUTRITION_KEYS.savedMeals, '/api/nutrition/saved-meals')

const { idToKey } = useNutrientCatalog()
const tray = useAddTray(idToKey)
const containerId = ref<number | undefined>()
watch(containers, (list) => {
  if (containerId.value !== undefined || !list?.length) return
  const wanted = queryNumber(route.query.containerId)
  containerId.value = list.some((c) => c.id === wanted) ? wanted : list[0]!.id
}, { immediate: true })
const containerName = computed(() => containers.value?.find((c) => c.id === containerId.value)?.name ?? '')
const containerMenuItems = computed<DropdownMenuItem[][]>(() => [
  (containers.value ?? []).map((c) => ({ label: c.name, onSelect: () => { containerId.value = c.id } }))
])

type AddSource = 'recent' | 'favorites' | 'mine'
type AddTab = AddSource | 'recipes' | 'meals' | 'online'

const activeTab = ref<AddTab>('recent')
const tabItems = [
  { label: 'Recent', value: 'recent', test: 'local-tab' },
  { label: '★', value: 'favorites', test: 'favorites-tab' },
  { label: 'Mine', value: 'mine', test: 'my-foods-tab' },
  { label: 'Recipes', value: 'recipes', test: 'recipes-tab' },
  { label: 'Meals', value: 'meals', test: 'meals-tab' },
  { label: 'Online', value: 'online', test: 'online-tab' }
]

const FOOD_TABS: AddTab[] = ['recent', 'favorites', 'mine']
const showFoodPicker = computed(() => FOOD_TABS.includes(activeTab.value))
const pickerSource = computed<AddSource>(() => (activeTab.value === 'favorites' || activeTab.value === 'mine') ? activeTab.value : 'recent')

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
  activeTab.value = 'recent'
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
          <UButton icon="i-lucide-chevron-left" variant="ghost" color="neutral" aria-label="Back" class="lg:hidden" :to="`/diary/${date}`" />
          <UDashboardSidebarCollapse class="hidden lg:flex" />
        </template>
        <template #title>
          <UDropdownMenu :items="containerMenuItems">
            <UButton
              :label="`Add to ${containerName}`"
              trailing-icon="i-lucide-chevron-down"
              variant="soft"
              color="neutral"
              size="sm"
              class="max-w-full truncate font-semibold"
              data-test="add-container"
            />
          </UDropdownMenu>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-2xl mx-auto w-full pb-24 lg:pb-0">
        <UTabs
          v-model="activeTab"
          :items="tabItems"
          :content="false"
          class="w-full"
          :ui="{ list: 'overflow-x-auto scrollbar-none', trigger: 'shrink-0 text-xs px-2 sm:text-sm sm:px-3' }"
        >
          <template #default="{ item }">
            <span :data-test="item.test">{{ item.label }}</span>
          </template>
        </UTabs>

        <div v-show="showFoodPicker" class="mt-4">
          <NutritionFoodPicker
            ref="picker"
            v-model="tray.state.foods"
            :source="pickerSource"
            :scan-to="`/diary/${date}/scan`"
            :needs-nutrition-food-id="needsNutritionFoodId"
          >
            <template #actions>
              <div class="flex gap-2 overflow-x-auto">
                <UButton icon="i-lucide-zap" label="Quick add" size="sm" variant="soft" color="neutral" data-test="toggle-quick-add" @click="quickAddOpen = true" />
                <UButton icon="i-lucide-plus" label="New food" size="sm" variant="soft" color="neutral" :to="`/diary/${date}/foods/new`" />
              </div>
            </template>
          </NutritionFoodPicker>
        </div>

        <div v-show="activeTab === 'recipes'" class="mt-4">
          <NutritionAddRecipes
            :recipes="recipes ?? []"
            :selected="tray.state.recipes"
            @toggle="(recipe, on) => tray.toggleRecipe(recipe, on)"
            @servings="(id, n) => tray.setRecipeServings(id, n)"
          />
        </div>

        <div v-show="activeTab === 'meals'" class="mt-4">
          <NutritionAddMeals :meals="meals ?? []" :selected="tray.state.meals" @toggle="(meal, on) => tray.toggleMeal(meal, on)" />
        </div>

        <div v-show="activeTab === 'online'" class="mt-4">
          <NutritionOnlineSearch @imported="onImported" />
        </div>
      </div>

      <NutritionAddTray
        :count="tray.count.value"
        :ready="tray.ready.value"
        :container-name="containerName"
        :items="trayItems"
        :totals="tray.totals.value"
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
