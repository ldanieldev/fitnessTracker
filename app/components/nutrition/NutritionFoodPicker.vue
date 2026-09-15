<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { FoodDetail, FoodHit, PickedFood } from '~/types/nutrition'
import { defaultUnit } from '~/composables/useFoodUnits'
import { errorMessage } from '~/utils/apiError'

const props = withDefaults(defineProps<{
  multiple?: boolean
  needsNutritionFoodId?: number | null
  source?: 'recent' | 'favorites' | 'mine'
  scanTo?: string
}>(), {
  multiple: true,
  needsNutritionFoodId: null,
  source: 'recent',
  scanTo: undefined
})

const picked = defineModel<PickedFood[]>({ default: () => [] })

const toast = useToast()
const query = ref('')
const hits = ref<FoodHit[]>([])
const degraded = ref(false)
const loaded = ref(false)
const loading = reactive(new Set<number>())
const details = reactive(new Map<number, FoodDetail>())

const { idToKey } = useNutrientCatalog()
const nutrientKeys = computed(() => Object.fromEntries(idToKey.value))

const pickedById = computed(() => new Map(picked.value.map((p) => [p.foodId, p])))
const pendingToggles = reactive(new Set<number>())
// Separate from `loading`: this only clears once `picked` itself has the entry, not just once the fetch resolves.
const pending = computed(() => pendingToggles.size > 0)

interface MineRow {
  id: number
  name: string
  brand: string | null
  defaultServing: { label: string, quantity: number } | null
  energy: number | null
  perDefault: FoodHit['perDefault']
}

function mineHit(row: MineRow): FoodHit {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    isFavorite: false,
    logCount: 0,
    energyDensity: null,
    perDefault: row.perDefault
  }
}

function pickedHit(p: PickedFood): FoodHit {
  return { id: p.foodId, name: p.name, brand: p.brand, isFavorite: false, logCount: 0, energyDensity: null, perDefault: null }
}

function hitNutrients(hit: FoodHit): Record<string, number | null | undefined> | null {
  if (!hit.perDefault) return null
  const { energy, protein, carbohydrate, fat } = hit.perDefault
  return { energy, protein, carbohydrate, fat }
}

async function fetchRecent(favorites: boolean) {
  const rows = await apiFetch<Array<Omit<FoodHit, 'energyDensity'>>>('/api/nutrition/foods/recent', { query: favorites ? { favorites: '1' } : {} })
  return { hits: rows.map((row) => ({ ...row, energyDensity: null, perDefault: row.perDefault ?? null })), degraded: false }
}

async function fetchMine(q: string) {
  const rows = await apiFetch<MineRow[]>('/api/nutrition/foods', { query: q ? { q } : {} })
  return { hits: rows.map(mineHit), degraded: false }
}

async function fetchSearch(q: string) {
  const result = await apiFetch<{ hits: FoodHit[], degraded: boolean }>('/api/nutrition/foods/search', { query: { q, limit: 25 } })
  const hits = result.hits.map((hit) => ({ ...hit, energyDensity: hit.energyDensity ?? null, perDefault: hit.perDefault ?? null }))
  // The search endpoint isn't favorites-scoped, so the ★ tab filters client-side to keep non-favourites from appearing under it.
  return { hits: props.source === 'favorites' ? hits.filter((hit) => hit.isFavorite) : hits, degraded: result.degraded }
}

let requestSeq = 0
async function runSearch() {
  const seq = ++requestSeq
  const trimmed = query.value.trim()
  try {
    const result = props.source === 'mine'
      ? await fetchMine(trimmed)
      : trimmed ? await fetchSearch(trimmed) : await fetchRecent(props.source === 'favorites')
    // drop stale responses: a slower recents/search fetch can resolve after a newer one and clobber its hits
    if (seq !== requestSeq) return
    // a picked food must stay on screen even when the fresh list (recents cap, search miss) does not contain it
    const missing = picked.value.filter((p) => !result.hits.some((hit) => hit.id === p.foodId)).map(pickedHit)
    hits.value = [...missing, ...result.hits]
    degraded.value = result.degraded
  } catch (error: unknown) {
    toast.add({ title: 'Search failed', description: errorMessage(error, 'Could not load foods'), color: 'error' })
  } finally {
    if (seq === requestSeq) loaded.value = true
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(runSearch, 250)
})

watch(() => props.source, runSearch)

let initialLoad: Promise<void> | null = null
onMounted(() => {
  initialLoad = runSearch()
})

async function loadDetail(id: number): Promise<FoodDetail | null> {
  const cached = details.get(id)
  if (cached) return cached
  loading.add(id)
  try {
    const food = await apiFetch<FoodDetail>(`/api/nutrition/foods/${id}`)
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
    hits.value = [{ id, name: food.name, brand: food.brand, isFavorite: false, logCount: 0, energyDensity: null, perDefault: null }, ...hits.value]
  }
  await toggle(id, true)
  // A caller driving select() before mount's own runSearch resolves would otherwise still see the loading skeleton.
  if (initialLoad) await initialLoad
}

defineExpose({ select, pending, runSearch, hitMenu })

async function toggleFavorite(hit: FoodHit) {
  try {
    await apiFetch(`/api/nutrition/foods/${hit.id}/favorite`, { method: hit.isFavorite ? 'DELETE' : 'PUT' })
    await runSearch()
  } catch (error: unknown) {
    toast.add({ title: 'Favourite failed', description: errorMessage(error, 'Could not update favourites'), color: 'error' })
  }
}

async function removeFromRecents(hit: FoodHit) {
  try {
    await apiFetch(`/api/nutrition/foods/${hit.id}/recent`, { method: 'DELETE' })
    await runSearch()
  } catch (error: unknown) {
    toast.add({ title: 'Remove failed', description: errorMessage(error, 'Could not remove this food from recents'), color: 'error' })
  }
}

function hitMenu(hit: FoodHit): DropdownMenuItem[][] {
  const items: DropdownMenuItem[] = [{ label: 'View food', icon: 'i-lucide-info', to: `/nutrition/foods/${hit.id}` }]
  if (props.source === 'recent') items.push({ label: 'Remove from recents', icon: 'i-lucide-eye-off', onSelect: () => removeFromRecents(hit) })
  return [items]
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <UInput v-model="query" placeholder="Search foods" aria-label="Search foods" icon="i-lucide-search" class="w-full" data-test="food-search-input">
      <template v-if="scanTo" #trailing>
        <UButton icon="i-lucide-scan-barcode" variant="ghost" size="xs" :to="scanTo" data-test="scan-button" />
      </template>
    </UInput>

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

    <NutritionListSkeleton v-if="!loaded" />
    <div v-else class="flex flex-col gap-2">
      <NutritionResultRow
        v-for="hit in hits"
        :key="hit.id"
        data-test="food-hit"
        :data-food-id="hit.id"
        :title="hit.name"
        :subtitle="hit.brand"
        :amount-text="hit.perDefault ? `${hit.perDefault.quantity} ${hit.perDefault.label}` : null"
        :nutrients="hitNutrients(hit)"
        :energy="hit.perDefault?.energy ?? null"
        selectable
        :selected="pickedById.has(hit.id)"
        :disabled="loading.has(hit.id)"
        @toggle="(on) => toggle(hit.id, on)"
      >
        <template #actions>
          <UButton
            variant="ghost"
            color="warning"
            size="sm"
            square
            :aria-label="hit.isFavorite ? 'Unfavorite' : 'Favorite'"
            data-test="favorite-toggle"
            @click.stop="toggleFavorite(hit)"
          >
            <!-- lucide paths carry fill="none" as an attribute, so the fill must target the path itself -->
            <UIcon name="i-lucide-star" mode="svg" class="size-5" :class="hit.isFavorite ? '[&_path]:fill-current' : ''" data-test="favorite-icon" />
          </UButton>
          <UDropdownMenu :items="hitMenu(hit)">
            <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" size="sm" aria-label="Food actions" @click.stop />
          </UDropdownMenu>
        </template>
        <template v-if="pickedById.get(hit.id)" #default>
          <NutritionAmountInput
            :food="pickedById.get(hit.id)!.food"
            :model-value="{ quantity: pickedById.get(hit.id)!.quantity, unitLabel: pickedById.get(hit.id)!.unitLabel }"
            :nutrient-keys="nutrientKeys"
            @update:model-value="(value) => setAmount(hit.id, value)"
          />
        </template>
      </NutritionResultRow>
      <p v-if="loaded && hits.length === 0" class="text-sm text-dimmed">No foods found</p>
    </div>
  </div>
</template>
