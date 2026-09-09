<script setup lang="ts">
import type { FoodForResolve } from '~~/shared/types/nutrition'
import type { DiaryEntryInput } from '~/composables/useDiaryDay'
import { defaultUnit } from '~/composables/useFoodUnits'
import { errorMessage } from '~/utils/apiError'

interface FoodHit {
  id: number
  name: string
  brand: string | null
  isFavorite: boolean
  logCount: number
  energyDensity: number | null
}

const props = defineProps<{
  date: string
  containers: Array<{ id: number, name: string }>
}>()

const emit = defineEmits<{
  submit: [inputs: DiaryEntryInput[]]
}>()

const toast = useToast()

const query = ref('')
const hits = ref<FoodHit[]>([])
const degraded = ref(false)

const containerItems = useContainerItems(() => props.containers)
const containerId = ref<number | undefined>(props.containers[0]?.id)

watch(
  () => props.containers,
  (list) => {
    if (containerId.value === undefined && list.length) containerId.value = list[0]!.id
  }
)

async function fetchRecent() {
  const rows = await $fetch<Array<{ id: number, name: string, brand: string | null, isFavorite: boolean, logCount: number }>>(
    '/api/nutrition/foods/recent'
  )
  hits.value = rows.map((row) => ({ ...row, energyDensity: null }))
  degraded.value = false
}

async function fetchSearch(q: string) {
  const result = await $fetch<{ hits: FoodHit[], degraded: boolean }>('/api/nutrition/foods/search', {
    query: { q, limit: 25 }
  })
  hits.value = result.hits
  degraded.value = result.degraded
}

async function runSearch() {
  const trimmed = query.value.trim()
  if (trimmed) await fetchSearch(trimmed)
  else await fetchRecent()
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(runSearch, 250)
})

onMounted(runSearch)

const checked = reactive(new Set<number>())
const amounts = reactive(new Map<number, { quantity: number, unitLabel: string }>())
const loadedFoods = reactive(new Map<number, FoodForResolve>())

const loading = reactive(new Set<number>())

async function loadFoodDetail(id: number) {
  loading.add(id)
  try {
    const food = await $fetch<FoodForResolve>(`/api/nutrition/foods/${id}`)
    loadedFoods.set(id, food)
    if (!amounts.get(id)?.unitLabel) {
      amounts.set(id, { quantity: amounts.get(id)?.quantity ?? 1, unitLabel: defaultUnit(food) })
    }
  } catch (error: unknown) {
    toast.add({ title: 'Load failed', description: errorMessage(error, 'Could not load this food'), color: 'error' })
    checked.delete(id)
  } finally {
    loading.delete(id)
  }
}

function toggleChecked(id: number, value: boolean) {
  if (value) {
    checked.add(id)
    if (!amounts.has(id)) amounts.set(id, { quantity: 1, unitLabel: '' })
    if (!loadedFoods.has(id)) loadFoodDetail(id)
  } else {
    checked.delete(id)
  }
}

const selectionReady = computed(() =>
  checked.size > 0 && [...checked].every((id) => loadedFoods.has(id) && Boolean(amounts.get(id)?.unitLabel))
)

function setAmount(id: number, value: { quantity: number, unitLabel: string }) {
  amounts.set(id, value)
}

async function toggleFavorite(hit: FoodHit) {
  try {
    await $fetch(`/api/nutrition/foods/${hit.id}/favorite`, { method: hit.isFavorite ? 'DELETE' : 'PUT' })
    await runSearch()
  } catch (error: unknown) {
    toast.add({ title: 'Favourite failed', description: errorMessage(error, 'Could not update favourites'), color: 'error' })
  }
}

const quickAddOpen = ref(false)

function submitSelection() {
  if (!selectionReady.value) return
  const inputs: DiaryEntryInput[] = [...checked].map((id) => {
    const amount = amounts.get(id)!
    return {
      entryType: 'food',
      foodId: id,
      containerId: containerId.value!,
      quantity: amount.quantity,
      unitLabel: amount.unitLabel
    }
  })
  emit('submit', inputs)
  checked.clear()
  amounts.clear()
}

function onQuickAddSubmit(input: DiaryEntryInput) {
  emit('submit', [input])
  quickAddOpen.value = false
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      <UInput
        v-model="query"
        placeholder="Search foods"
        icon="i-lucide-search"
        class="flex-1"
        data-test="food-search-input"
      />
      <USelect v-model="containerId" :items="containerItems" class="w-40" data-test="food-search-container" />
    </div>

    <UAlert
      v-if="degraded"
      color="warning"
      variant="soft"
      title="Search is running in basic mode"
      data-test="degraded-hint"
    />

    <div class="flex flex-col gap-2">
      <div v-for="hit in hits" :key="hit.id" class="flex flex-col gap-2 p-2 rounded-lg bg-elevated/50" data-test="food-hit">
        <div class="flex items-center gap-2">
          <UCheckbox
            :model-value="checked.has(hit.id)"
            data-test="food-hit-checkbox"
            @update:model-value="(value) => toggleChecked(hit.id, Boolean(value))"
          />
          <UButton
            :icon="hit.isFavorite ? 'i-lucide-star' : 'i-lucide-star-off'"
            variant="ghost"
            color="warning"
            size="xs"
            :aria-label="hit.isFavorite ? 'Unfavorite' : 'Favorite'"
            @click="toggleFavorite(hit)"
          />
          <span class="font-medium">{{ hit.name }}</span>
          <span v-if="hit.brand" class="text-dimmed text-sm">{{ hit.brand }}</span>
          <span v-if="hit.energyDensity !== null" class="text-dimmed text-xs ml-auto">
            {{ hit.energyDensity.toFixed(0) }} kcal/100 g
          </span>
        </div>
        <NutritionAmountInput
          v-if="checked.has(hit.id) && loadedFoods.get(hit.id)"
          :food="loadedFoods.get(hit.id)!"
          :model-value="amounts.get(hit.id)!"
          :disabled="loading.has(hit.id) || !amounts.get(hit.id)?.unitLabel"
          @update:model-value="(value) => setAmount(hit.id, value)"
        />
      </div>
      <p v-if="hits.length === 0" class="text-sm text-dimmed">No foods found</p>
    </div>

    <div class="flex items-center gap-2">
      <UButton :label="`Add ${checked.size}`" :disabled="!selectionReady" data-test="add-selected" @click="submitSelection" />
      <UButton
        label="Quick add"
        variant="soft"
        color="neutral"
        data-test="toggle-quick-add"
        @click="quickAddOpen = !quickAddOpen"
      />
      <UButton :to="`/diary/${date}/foods/new`" label="New food" variant="ghost" color="neutral" />
    </div>

    <NutritionQuickAddForm v-if="quickAddOpen" :containers="containers" @submit="onQuickAddSubmit" />
  </div>
</template>
