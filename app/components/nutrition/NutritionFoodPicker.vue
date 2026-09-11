<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { FoodDetail, FoodHit, PickedFood } from '~/types/nutrition'
import { defaultUnit } from '~/composables/useFoodUnits'
import { errorMessage } from '~/utils/apiError'

const props = withDefaults(defineProps<{ multiple?: boolean, needsNutritionFoodId?: number | null }>(), {
  multiple: true,
  needsNutritionFoodId: null
})

const picked = defineModel<PickedFood[]>({ default: () => [] })

const toast = useToast()
const query = ref('')
const hits = ref<FoodHit[]>([])
const degraded = ref(false)
const loading = reactive(new Set<number>())
const details = reactive(new Map<number, FoodDetail>())

const pickedById = computed(() => new Map(picked.value.map((p) => [p.foodId, p])))
const pendingToggles = reactive(new Set<number>())
// Separate from `loading`: this only clears once `picked` itself has the entry, not just once the fetch resolves.
const pending = computed(() => pendingToggles.size > 0)

async function fetchRecent() {
  const rows = await $fetch<Array<Omit<FoodHit, 'energyDensity'>>>('/api/nutrition/foods/recent')
  return { hits: rows.map((row) => ({ ...row, energyDensity: null })), degraded: false }
}

async function fetchSearch(q: string) {
  const result = await $fetch<{ hits: FoodHit[], degraded: boolean }>('/api/nutrition/foods/search', { query: { q, limit: 25 } })
  return { hits: result.hits.map((hit) => ({ ...hit, energyDensity: hit.energyDensity ?? null })), degraded: result.degraded }
}

let requestSeq = 0
async function runSearch() {
  const seq = ++requestSeq
  const trimmed = query.value.trim()
  try {
    const result = trimmed ? await fetchSearch(trimmed) : await fetchRecent()
    // drop stale responses: a slower recents/search fetch can resolve after a newer one and clobber its hits
    if (seq !== requestSeq) return
    hits.value = result.hits
    degraded.value = result.degraded
  } catch (error: unknown) {
    toast.add({ title: 'Search failed', description: errorMessage(error, 'Could not load foods'), color: 'error' })
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(runSearch, 250)
})

onMounted(runSearch)

async function loadDetail(id: number): Promise<FoodDetail | null> {
  const cached = details.get(id)
  if (cached) return cached
  loading.add(id)
  try {
    const food = await $fetch<FoodDetail>(`/api/nutrition/foods/${id}`)
    details.set(id, food)
    return food
  } catch (error: unknown) {
    toast.add({ title: 'Load failed', description: errorMessage(error, 'Could not load this food'), color: 'error' })
    return null
  } finally {
    loading.delete(id)
  }
}

async function toggle(id: number, value: boolean) {
  if (!value) {
    picked.value = picked.value.filter((p) => p.foodId !== id)
    return
  }
  const existing = picked.value.find((p) => p.foodId === id)
  if (existing) {
    if (!props.multiple) {
      picked.value = [existing]
    }
    return
  }
  pendingToggles.add(id)
  try {
    const food = await loadDetail(id)
    if (!food) return
    const entry: PickedFood = { foodId: id, name: food.name, brand: food.brand, quantity: 1, unitLabel: defaultUnit(food), food }
    picked.value = props.multiple ? [...picked.value, entry] : [entry]
  } finally {
    pendingToggles.delete(id)
  }
}

function setAmount(id: number, value: { quantity: number, unitLabel: string }) {
  picked.value = picked.value.map((p) => (p.foodId === id ? { ...p, ...value } : p))
}

async function select(id: number) {
  const food = await loadDetail(id)
  if (!food) return
  if (!hits.value.some((hit) => hit.id === id)) {
    hits.value = [{ id, name: food.name, brand: food.brand, isFavorite: false, logCount: 0, energyDensity: null }, ...hits.value]
  }
  await toggle(id, true)
}

defineExpose({ select, pending })

async function toggleFavorite(hit: FoodHit) {
  try {
    await $fetch(`/api/nutrition/foods/${hit.id}/favorite`, { method: hit.isFavorite ? 'DELETE' : 'PUT' })
    await runSearch()
  } catch (error: unknown) {
    toast.add({ title: 'Favourite failed', description: errorMessage(error, 'Could not update favourites'), color: 'error' })
  }
}

function hitMenu(hit: FoodHit): DropdownMenuItem[][] {
  return [[{ label: 'View food', icon: 'i-lucide-info', to: `/nutrition/foods/${hit.id}` }]]
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <UInput v-model="query" placeholder="Search foods" icon="i-lucide-search" class="w-full" data-test="food-search-input" />

    <slot name="actions" />

    <UAlert v-if="degraded" color="warning" variant="soft" title="Search is running in basic mode" data-test="degraded-hint" />

    <UAlert
      v-if="needsNutritionFoodId !== null"
      color="warning"
      variant="soft"
      title="Imported without nutrition"
      :actions="[{ label: 'Add nutrition', to: `/nutrition/foods/${needsNutritionFoodId}`, color: 'warning', variant: 'outline' }]"
      data-test="needs-nutrition-alert"
    />

    <div class="flex flex-col gap-2">
      <div v-for="hit in hits" :key="hit.id" class="flex flex-col gap-2 p-2 rounded-lg bg-elevated/50" data-test="food-hit">
        <div class="flex items-center gap-2 min-w-0">
          <UCheckbox
            :model-value="pickedById.has(hit.id)"
            :disabled="loading.has(hit.id)"
            data-test="food-hit-checkbox"
            @update:model-value="(value) => toggle(hit.id, Boolean(value))"
          />
          <div class="flex flex-col min-w-0 flex-1">
            <span class="font-medium truncate">{{ hit.name }}</span>
            <span class="text-dimmed text-xs truncate">
              <template v-if="hit.brand">{{ hit.brand }}</template>
              <template v-if="hit.energyDensity !== null"> · {{ hit.energyDensity.toFixed(0) }} kcal/100 g</template>
            </span>
          </div>
          <UButton
            :icon="hit.isFavorite ? 'i-lucide-star' : 'i-lucide-star-off'"
            variant="ghost"
            color="warning"
            size="sm"
            :aria-label="hit.isFavorite ? 'Unfavorite' : 'Favorite'"
            @click="toggleFavorite(hit)"
          />
          <UDropdownMenu :items="hitMenu(hit)">
            <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" size="sm" aria-label="Food actions" />
          </UDropdownMenu>
        </div>
        <NutritionAmountInput
          v-if="pickedById.get(hit.id)"
          :food="pickedById.get(hit.id)!.food"
          :model-value="{ quantity: pickedById.get(hit.id)!.quantity, unitLabel: pickedById.get(hit.id)!.unitLabel }"
          @update:model-value="(value) => setAmount(hit.id, value)"
        />
      </div>
      <p v-if="hits.length === 0" class="text-sm text-dimmed">No foods found</p>
    </div>
  </div>
</template>
